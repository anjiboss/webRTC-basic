import io from "socket.io-client";
import { server_uri } from "./ultis/constant";
export const socket = io(server_uri, { reconnection: false });

let caller: undefined | string;
let g_to: undefined | string;

let localStream: MediaStream | null = null;
let remoteStream: MediaStream | null = null;

const webcamButton = document.getElementById(
  "webcamButton"
) as HTMLButtonElement;
const webcamVideo = document.getElementById("webcamVideo") as HTMLVideoElement;
const remoteVideo = document.getElementById("remoteVideo") as HTMLVideoElement;
const callButton = document.getElementById("callButton") as HTMLButtonElement;
const offerInput = document.getElementById("offerInput") as HTMLInputElement;
const answerInput = document.getElementById("answerInput") as HTMLInputElement;
const messageInput = document.getElementById("message") as HTMLInputElement;
const answerButton = document.getElementById(
  "answerButton"
) as HTMLButtonElement;
const acceptButton = document.getElementById(
  "acceptButton"
) as HTMLButtonElement;

const messageButton = document.getElementById(
  "messageButton"
) as HTMLButtonElement;
// const screenVideo = document.getElementById("screenVideo") as HTMLVideoElement;

// SECTION Send screen instead
var displayMediaOptions: DisplayMediaStreamConstraints = {
  video: {},
  audio: false,
};

async function startCapture(displayMediaOptions: any) {
  let captureStream = null;

  try {
    captureStream = await navigator.mediaDevices.getDisplayMedia(
      displayMediaOptions
    );
  } catch (err) {
    console.error("Error: " + err);
  }
  return captureStream;
}

$("#screen").on("click", async () => {
  localStream = await startCapture(displayMediaOptions);

  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream!.getTracks().forEach((track) => {
    localConnection.addTrack(track, localStream!);
  });

  // Pull tracks from remote stream, add to video stream
  localConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream!.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
});
// !SECTION

const localConnection = new RTCPeerConnection({
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
});

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
  });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream!.getTracks().forEach((track) => {
    localConnection.addTrack(track, localStream!);
  });

  // Pull tracks from remote stream, add to video stream
  localConnection.ontrack = (event) => {
    event.streams[0].getTracks().forEach((track) => {
      remoteStream!.addTrack(track);
    });
  };

  webcamVideo.srcObject = localStream;
  remoteVideo.srcObject = remoteStream;
};

//ANCHOR New ICECandidata Event Set up save SDP as Local Description
localConnection.onicecandidate = (_) => {
  console.log(
    "NEW CANDIDATE",
    JSON.stringify(localConnection.localDescription)
  );
  console.log("1", localConnection.connectionState);
  if (localConnection.localDescription?.type === "answer") {
    socket.emit("answering", {
      answer: localConnection.localDescription,
    });
  } else if (localConnection.localDescription?.type === "offer") {
    socket.emit("calling", {
      to: g_to,
      offer: localConnection.localDescription,
      from: caller,
    });
  }
};

// Create Channel for sending things
const sendChannel = localConnection.createDataChannel("sendChannel");

// Events for logging
sendChannel.onmessage = (e) => {
  console.log("messsage received!!!" + e.data, e);
};
sendChannel.onopen = () => console.log("open!!!! 1");
sendChannel.onclose = () => console.log("closed!!!!!!");

// ANCHOR Create Offer
export const createOffer = (to?: string) => {
  localConnection.createOffer().then(async (o) => {
    localConnection.setLocalDescription(o).then(() => {
      console.log("OFFER", JSON.stringify(o));
      if (to) {
        g_to = to;
        socket.emit("calling", { to, offer: o, from: caller });
      }
    });
  });
};
callButton.onclick = () => createOffer();

// ANCHOR Answer Call
const answerCall = async (off?: RTCSessionDescriptionInit) => {
  const offer = off || JSON.parse(offerInput.value);
  localConnection
    .setRemoteDescription(offer)
    .then((_) => console.log("setted remote description"));
  //create answer
  if (!["connected"].includes(localConnection.connectionState))
    await localConnection
      .createAnswer()
      .then((a) => localConnection.setLocalDescription(a))
      .then((_) => {
        console.log(
          "THIS IS ANSWER SDP",
          JSON.stringify(localConnection.localDescription)
        );
        socket.emit("answering", {
          answer: localConnection.localDescription,
        });
      });
};
answerButton.onclick = () => {
  answerCall();
};

// ANCHOR  Accepting Call
const acceptCall = (answer?: string) => {
  const answerSDP = answer || JSON.parse(answerInput.value);

  if (!["new", "connected"].includes(localConnection.connectionState)) {
    localConnection
      .setRemoteDescription(answerSDP)
      .then((_) => console.log("remote description setted"));
  }
};

acceptButton.onclick = () => {
  acceptCall();
};

let _receivedChannel: any = null;

localConnection.ondatachannel = (e) => {
  const receiveChannel = e.channel;
  receiveChannel.onmessage = (e) =>
    console.log("messsage received!!!" + e.data);
  receiveChannel.onopen = (_) => console.log("open!!!! 2");
  receiveChannel.onclose = (_) => console.log("closed!!!!!!");
  _receivedChannel = receiveChannel;
};

messageButton.onclick = () => {
  const message = messageInput.value;
  console.log("sending...", message);
  _receivedChannel.send("message: " + message);
};

socket.on(
  "incoming-call",
  ({ offer }: { offer: RTCSessionDescriptionInit }) => {
    console.log("incoming call", { offer });
    answerCall(offer);
  }
);

socket.on("accepting-call", ({ answer }) => {
  acceptCall(answer);
});

socket.on("registered", ({ username, id }) => {
  caller = username;
  console.log(id);
});

socket.on("log", (msg) => {
  console.log(msg);
});
