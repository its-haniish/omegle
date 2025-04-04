const socket=io();
let peerConnection;
let localStream;
let iceCandidateQueue=[];
let isInitiator=false;

const localVideo=document.getElementById("video");
const remoteVideo=document.getElementById("video_random");
const loadingScreen=document.getElementById("loading_next_screen");
const chatMessages=document.getElementById("chat_messages");
const sendMsgBtn=document.getElementById("send_btn");
const messageInput=document.getElementById("chat_input");
document.getElementById("dev_btn").addEventListener("click", () => {
    window.open("https://github.com/its-haniish", "_blank");
});

document.getElementById("report_btn").addEventListener("click", () => {
    window.open("https://github.com/its-haniish", "_blank");
});


const config={
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function resetConnection() {
    if (peerConnection) {
        peerConnection.ontrack=null;
        peerConnection.onicecandidate=null;
        peerConnection.oniceconnectionstatechange=null;
        peerConnection.onicegatheringstatechange=null;
        peerConnection.onsignalingstatechange=null;

        peerConnection.getSenders().forEach(sender => peerConnection.removeTrack(sender));

        peerConnection.close();
        peerConnection=null;
        console.log("🔄 PeerConnection fully reset.");
    }

    if (remoteVideo.srcObject) {
        remoteVideo.srcObject.getTracks().forEach(track => {
            track.stop(); // Stop each track properly
        });
        remoteVideo.srcObject=null;
    }

    if (localStream) {
        localStream.getTracks().forEach(track => {
            track.stop(); // Ensure local stream is fully stopped
        });
        localStream=null;
    }

    isMatched=false;  // Reset matching state
}




// 🎥 Get user media with permission check
async function getMedia() {
    let permissionGranted=false;

    while (!permissionGranted) {
        try {
            localStream=await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject=localStream;
            console.log("✅ Local stream initialized.");
            permissionGranted=true; // User granted access

            localStream.getTracks().forEach(track => {
                console.log(`🎙️ Local ${track.kind} track — enabled: ${track.enabled}, readyState: ${track.readyState}`);
            });

        } catch (error) {
            console.error("❌ Error accessing media devices:", error);
            alert("⚠️ Please allow camera and microphone access for the chat to work.");
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s before retrying
        }
    }
}

// 📡 Setup Peer Connection
function setupPeerConnection() {
    if (peerConnection) {
        console.warn("🔁 PeerConnection already exists. Skipping setup.");
        return;
    }

    peerConnection=new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => {
        console.log("➡️ Adding local track:", track.kind);
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.onicecandidate=(event) => {
        if (event.candidate) {
            socket.emit("signal", { candidate: event.candidate });
        }
    };

    peerConnection.ontrack=(event) => {
        console.log("🎥 Received track:", event.track.kind);

        event.streams.forEach((stream, i) => {
            console.log(`🔗 Received stream #${i}:`, stream.getTracks().map(t => t.kind));
        });

        remoteVideo.srcObject=event.streams[0];

        remoteVideo.onloadedmetadata=() => {
            console.log("✅ Metadata loaded. Trying to play remote video...");
            loadingScreen.style.display="none";
            remoteVideo.style.display="block";

            remoteVideo.play().catch(err => {
                console.error("❌ Video play failed:", err);
                retryRemoteVideo();
            });

            // Check if video is actually playing
            setTimeout(() => {
                if (remoteVideo.readyState<3) {  // 3 = "HAVE_FUTURE_DATA"
                    console.warn("⚠️ Remote video is not playing. Reloading...");
                    retryRemoteVideo();
                }
            }, 3000); // Wait 3 seconds before checking
        };
    };

    // Function to retry video play or reload
    function retryRemoteVideo() {
        remoteVideo.srcObject=null;
        remoteVideo.style.display="none";
        loadingScreen.style.display="flex";

        setTimeout(() => {
            window.location.reload();
        }, 1000); // Reload after 1 second
    }

}

// ✉️ Create and send offer
async function createAndSendOffer() {
    if (!localStream) {
        console.error("🚫 No localStream available!");
        return;
    }

    isInitiator=true;
    setupPeerConnection(); // adds tracks and listeners

    try {
        const offer=await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit("join_chat", { offer });
    } catch (err) {
        console.error("❌ Error creating/sending offer:", err);
    }
}

// 🧩 Handle match found
let isMatched=false;
socket.on("match_found", async (data) => {
    if (isMatched) {
        console.warn("⚠️ Already matched. Ignoring extra match_found.");
        return;
    }

    isMatched=true;
    loadingScreen.style.display="none";
    remoteVideo.style.display="block";

    if (data.offer) {
        // I am the receiver
        isInitiator=false;
        setupPeerConnection();

        console.log("🎯 Setting Remote Offer:", data.offer);

        if (!peerConnection.remoteDescription) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                console.log("✅ Remote Offer Set Successfully");

                while (iceCandidateQueue.length) {
                    const candidate=iceCandidateQueue.shift();
                    await peerConnection.addIceCandidate(candidate);
                }

                const answer=await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                socket.emit("signal", { answer });
            } catch (error) {
                console.error("❌ Error processing offer:", error);
            }
        } else {
            console.warn("⚠ Remote description already set.");
        }
    } else {
        // I am the initiator
        isInitiator=true;
        createAndSendOffer(); // internally calls setupPeerConnection
    }
});

// 🧊 Handle ICE & answer
socket.on("signal", async (data) => {
    if (data.answer) {
        if (
            peerConnection.signalingState==="have-local-offer"||
            peerConnection.signalingState==="stable"
        ) {
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
                console.log("✅ Remote answer set successfully.");
            } catch (err) {
                console.error("❌ Failed to set remote answer:", err);
            }
        } else {
            console.warn("⚠ Skipping setRemoteDescription (answer): Invalid state", peerConnection.signalingState);
        }
    } else if (data.candidate) {
        if (peerConnection?.remoteDescription) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
                console.log("✅ Added ICE candidate");
            } catch (err) {
                console.error("❌ Error adding ICE candidate:", err);
            }
        } else {
            console.warn("📥 Queuing ICE candidate, waiting for remote description");
            iceCandidateQueue.push(new RTCIceCandidate(data.candidate));
        }
    }
});



socket.on("message", (message) => {
    if (!message||!isMatched) return;

    // Create a new message element
    const msgElement=document.createElement("div");
    msgElement.classList.add("message");
    msgElement.classList.add("stranger-message");

    // Set message text
    msgElement.textContent=message;

    // Append message to chat container
    chatMessages.appendChild(msgElement);

    // Auto-scroll to the latest message
    chatMessages.scrollTop=chatMessages.scrollHeight;
});

sendMsgBtn.addEventListener("click", () => {
    if (!isMatched) {
        console.warn("⚠️ Not matched. Can't send message.");
        return;
    }
    const message=messageInput.value.trim();

    if (message) {
        // Create a new message element
        const msgElement=document.createElement("div");
        msgElement.classList.add("message");
        msgElement.classList.add("your-message");

        // Set message text
        msgElement.textContent=message;

        // Append message to chat container
        chatMessages.appendChild(msgElement);

        // Auto-scroll to the latest message
        chatMessages.scrollTop=chatMessages.scrollHeight;

        // Send the message to the server
        socket.emit("message", message);

        // Clear the input field
        messageInput.value="";
    }
});

messageInput.addEventListener("keydown", (event) => {
    if (!isMatched) {
        console.warn("⚠️ Not matched. Can't send message.");
        return;
    }
    if (event.key==="Enter") {
        sendMsgBtn.click();
    }
});

document.getElementById("disconnect_btn").addEventListener("click", () => {
    window.location.reload();
    console.log("🔌 Disconnected from chat.");
});


socket.on("partner_disconnected", () => {
    window.location.reload();
    console.log("👤 Your partner has disconnected. Reloading...");
});




// 🟢 Start on page load
window.onload=async () => {
    const storedData=checkLocalData();
    document.getElementById("select_gender_screen").style.display="none";
    document.getElementById("identify_gender_screen").style.display="none";
    loadingScreen.style.display="flex"

    await getMedia(); // Get user media on load

    if (storedData) {
        // Bypass gender detection and start looking for a partner
        console.log("🚀 Starting chat with stored gender data:", storedData);
        socket.emit("gender_detected", storedData);
        await createAndSendOffer(); // Start finding a chat partner
    } else {
        loadingScreen.style.display="none";
        document.getElementById("select_gender_screen").style.display="block";
    }
};
