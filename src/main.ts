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

const localConnection = new RTCPeerConnection({
  // iceServers: [
  //   {
  //     urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
  //   },
  // ],
});

webcamButton.onclick = async () => {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  remoteStream = new MediaStream();

  // Push tracks from local stream to peer connection
  localStream.getTracks().forEach((track) => {
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

// Set up save SDP as Local Description
localConnection.onicecandidate = (_e) => {
  console.log(JSON.stringify(localConnection.localDescription));
  navigator.clipboard.writeText(
    JSON.stringify(localConnection.localDescription)
  );
};

// Create Channel for sending things
const sendChannel = localConnection.createDataChannel("sendChannel");

// Events for logging
sendChannel.onmessage = (e) => {
  console.log("messsage received!!!" + e.data, e);
};
sendChannel.onopen = () => console.log("open!!!! 1");
sendChannel.onclose = () => console.log("closed!!!!!!");

callButton.onclick = () => {
  localConnection
    .createOffer()
    .then((o) => localConnection.setLocalDescription(o))
    .then(() => {
      console.log("seted local description");
    });
};

answerButton.onclick = async () => {
  const offer = JSON.parse(offerInput.value);
  localConnection
    .setRemoteDescription(offer)
    .then((_) => console.log("setted remote description"));
  //create answer
  await localConnection
    .createAnswer()
    .then((a) => localConnection.setLocalDescription(a))
    .then((_) => {
      console.log(JSON.stringify(localConnection.localDescription));
    });
};

acceptButton.onclick = () => {
  const answerSDP = JSON.parse(answerInput.value);
  localConnection
    .setRemoteDescription(answerSDP)
    .then((_) => console.log("done"));
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
