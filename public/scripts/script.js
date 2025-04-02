const socket=io();
let peer;
const localVideo=document.getElementById('video');
const remoteVideo=document.getElementById('video_random');
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Function to create an RTC PeerConnection and send an offer
async function createAndSendOffer() {
  peerConnection = new RTCPeerConnection(config);

  // Add local stream to connection
  localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

  // Create Offer
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Send Offer in `join_chat` event
  socket.emit("join_chat", { offer });
}

socket.on("match_found", async (data) => {
    peerConnection = new RTCPeerConnection(config);

    // Add local stream to connection
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Handle remote stream
    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    // Handle ICE candidate exchange
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit("signal", { candidate: event.candidate });
        }
    };

    // ✅ **If offer exists, accept it and send an answer**
    if (data.offer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        let answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        socket.emit("signal", { answer }); // Send answer back to the original offer sender
    }
});


// ✅ Handle incoming signals (ICE candidates & answers)
socket.on("signal", async (data) => {
    if (data.answer) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } else if (data.candidate) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    }
});

// Handle disconnection
socket.on("partner_disconnected", () => {
    alert("Your partner has disconnected.");
    peerConnection.close();
    window.location.reload();
});