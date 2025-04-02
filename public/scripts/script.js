const socket=io();
let peerConnection;
let localStream;
let iceCandidateQueue=[]; // Queue for ICE candidates before remote description is set

// 🔹 Get video elements
const localVideo=document.getElementById("video");
const remoteVideo=document.getElementById("video_random");
const loadingScreen=document.getElementById("loading_next_screen");

// 🔹 WebRTC configuration
const config={
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

// ✅ Function to get camera/microphone access
async function getMedia() {
    try {
        localStream=await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localVideo.srcObject=localStream;
        console.log("✅ Local stream initialized.");
    } catch (error) {
        console.error("❌ Error accessing media devices:", error);
    }
}

// ✅ Function to create and send an offer
async function createAndSendOffer() {
    if (!localStream) {
        console.error("No localStream available!");
        return;
    }

    peerConnection=new RTCPeerConnection(config);
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack=(event) => {
        console.log("🎥 Received remote stream:", event.streams[0]);
        remoteVideo.srcObject=event.streams[0];
    };

    peerConnection.onicecandidate=(event) => {
        if (event.candidate) {
            socket.emit("signal", { candidate: event.candidate });
        }
    };

    const offer=await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    socket.emit("join_chat", { offer });
}

// ✅ Handle match found event
socket.on("match_found", async (data) => {
    peerConnection=new RTCPeerConnection(config);
    localStream.getTracks().forEach((track) => peerConnection.addTrack(track, localStream));

    loadingScreen.style.display="none";
    remoteVideo.style.display="block";

    if (!peerConnection.ontrack) {
        peerConnection.ontrack=(event) => {
            if (remoteVideo.srcObject!==event.streams[0]) {
                console.log("🎥 Received remote stream:", event.streams[0]);
                remoteVideo.srcObject=event.streams[0];
                remoteVideo.play(); // Ensure playback starts
            }
        };
    }


    peerConnection.onicecandidate=(event) => {
        if (event.candidate) {
            socket.emit("signal", { candidate: event.candidate });
        }
    };

    if (data.offer) {
        console.log("🎯 Setting Remote Offer:", data.offer);

        if (peerConnection.signalingState!=="stable") {
            console.warn("⚠ Skipping setRemoteDescription: Invalid state", peerConnection.signalingState);
            return;
        }

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
            console.log("✅ Remote Offer Set Successfully");

            // Process queued ICE candidates
            while (iceCandidateQueue.length) {
                let candidate=iceCandidateQueue.shift();
                peerConnection.addIceCandidate(candidate);
            }

            let answer=await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit("signal", { answer });
        } catch (error) {
            console.error("❌ Error processing offer:", error);
        }
    }
});

// ✅ Handle signaling (ICE candidates & answers)
socket.on("signal", async (data) => {
    if (data.answer) {
        if (peerConnection.signalingState==="have-local-offer") {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
        } else {
            console.warn("⚠ Skipping setRemoteDescription: Invalid state", peerConnection.signalingState);
        }
    } else if (data.candidate) {
        if (peerConnection.remoteDescription) {
            await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } else {
            console.warn("Queuing ICE candidate, waiting for remote description");
            iceCandidateQueue.push(new RTCIceCandidate(data.candidate));
        }
    }
});

// ✅ Handle disconnection
socket.on("partner_disconnected", () => {
    alert("Your partner has disconnected.");
    document.getElementById("loading_next_screen").style.display="flex";
    if (peerConnection) peerConnection.close();
});

// ✅ Initialize media on page load
getMedia();
