var socket = io();

class Chatroom {
    ChatID;
    ChatName;
    UserList;
    ActiveUserList;
    MessageList;
    PasswordProtected;

    constructor(id, name) {
        this.ChatID = id;
        this.ChatName = name;
        this.UserList = [];
        this.ActiveUserList = [];
        this.MessageList = [];
        this.PasswordProtected = false;
    }
}

class ChatMessage {
    UserID;
    UserName; // temp
    Message;
    //Timestamp;

    constructor(id, name, message) {
        this.UserID = id;
        this.UserName = name;
        this.Message = message;
    }
}


const chatInput = document.getElementById("chatMessageInput");
const chatLogContainer = document.getElementById("chatLogContainer");
let chatLog = null;

const chatDiv = document.getElementById("chatDiv");
const discoveryDiv = document.getElementById("discoveryDiv");
const settingsDiv = document.getElementById("settingsDiv");

const chatroomFormPasswordToggle = document.getElementById("createChatroomPasswordToggle");

let currentTab = "";
let currentRoomID = -1;

socket.on("ServerMessage", (message) => {
    OnServerMessage(message);
});

socket.on("SessionStorage", (counter) => {
    InitSessionStorage(counter);
});

socket.on("receiveDiscovery", (rooms) => {
    OnReceiveDiscovery(rooms);
});

socket.on("receiveRoomList", (roomList) => {
    OnReceiveChatroomList(roomList);
});

socket.on("receiveChatroom", (room) => {
    OnReceiveChatroom(room);
});

socket.on("newMessageRoom", (message) => {
    OnNewMessageInChatroom(message);
});

socket.on("redirectToRoom", (roomID) => {
    RedirectToChatroom(roomID);
});


// ========== Initialisation ==========

// pt er data bare userCounter, så altid Number
function InitSessionStorage(data) {
    sessionStorage.setItem("username", "Bruger " + String(data));
}

function Entry() {
    chatInput.addEventListener("keydown", OnKeyDownChatMessageInput);
}

function OnServerMessage(message) {
    alert(message);
}


// ========== Account ==========

function TryChangeDisplayName() {
    const input = document.getElementById("displayNameInput");
    const newName = input.value;

    socket.emit("changeDisplayName", newName);
}


// ========== Chatroom ==========

// Listen af chatrum på siden
function OnReceiveChatroomList(roomList) {
    //console.log("Listing " + roomList.length + " rooms");
    const chatList = document.getElementById("chatList");

    for (let i = 0; i < roomList.length; i++) {
        const room = roomList[i];
        
        let roomListing = document.createElement("div");

        let button = document.createElement("button");
        button.innerText = room.ChatName;
        button.onclick = function () { socket.emit("tryEnterRoom", room.ChatID) };
        roomListing.appendChild(button);

        chatList.appendChild(roomListing);
    }
}

function RedirectToChatroom(roomID) {
    ChangeActiveWindow("chat");
    socket.emit("tryEnterRoom", roomID);
}

// Selve chatrummet med beskeder, brugere, osv
function OnReceiveChatroom(room) {
    currentRoomID = room.ChatID;

    const messages = room.MessageList;

    if (chatLogContainer.children.length !== 0) {
        chatLogContainer.removeChild(chatLogContainer.firstChild);
    }

    chatLog = document.createElement("div");
    chatLog.classList.add("ChatLog");

    for (let i = 0; i < messages.length; i++) {
        let message = document.createElement("div");
        message.classList.add("ChatMessage");

        let name = document.createElement("span");
        name.innerText = messages[i].UserName;
        name.classList.add("ChatMessageName");
        message.appendChild(name);

        let msg = document.createElement("span");
        msg.innerText = messages[i].Message;
        msg.classList.add("ChatMessageContent");
        message.appendChild(msg);

        chatLog.appendChild(message);
    }

    chatLogContainer.appendChild(chatLog);
}


// ========== Messages ==========

function OnKeyDownChatMessageInput(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        SendMessageInChatroom();
    }
}

// Senere, når brugere er knyttet på DB, skal navn og ID findes andre steder
function SendMessageInChatroom() {
    if (chatInput.value) {
        socket.emit("chatMessageRoom", socket.id, currentRoomID, chatInput.value);
        chatInput.value = "";
    }
}

function OnNewMessageInChatroom(message) {
    let newMessage = document.createElement("div");
    newMessage.classList.add("ChatMessage");

    let name = document.createElement("span");
    name.innerText = message.UserName;
    name.classList.add("ChatMessageName");
    newMessage.appendChild(name);

    let msg = document.createElement("span");
    msg.innerText = message.Message;
    msg.classList.add("ChatMessageContent");
    newMessage.appendChild(msg);

    chatLog.appendChild(newMessage);
}


// ========== Discovery ==========

function OnReceiveDiscovery(rooms) {
    for (let i = 0; i < rooms.length; i++) {
        let box = document.createElement("div");
        box.classList.add("DiscoveryShowcaseBox");
        
        let name = document.createElement("span");
        name.innerText = String(rooms[i].ChatName);
        box.appendChild(name);

        let button = document.createElement("button");
        button.innerText = "Deltag";
        button.onclick = function() { TryJoinChatroom(rooms[i].ChatID) };
        box.appendChild(button);

        discoveryGrid.appendChild(box);
    }
}

function TryJoinChatroom(roomID) {
    socket.emit("tryJoinRoom", roomID);
}


// ========== Creating chatrooms ==========

function ToggleFormPassword() {
    const passwordField = document.getElementById("createChatroomPassword");
    
    if (chatroomFormPasswordToggle.checked) {
        passwordField.removeAttribute("disabled");
    }
    else {
        passwordField.setAttribute("disabled", "");
    }
}

function TryCreatePublicChatroom() {
    const nameField = document.getElementById("createChatroomName");
    const passwordField = document.getElementById("createChatroomPassword");
    const privateCheck = document.getElementById("createChatroomPrivateToggle");

    const roomName = nameField.value;
    let roomPassword = "";
    let roomIsPrivate = false;
        
    if (chatroomFormPasswordToggle.checked) {
        roomPassword = passwordField.value;
    }

    if (privateCheck.checked) {
        roomIsPrivate = true;
    }

    socket.emit("tryCreatePublicChatroom", roomName);
}


// ========== Sidebar / GUI ==========

function ChangeActiveWindow(windowName) {
    // Åbner ikke den samme menu igen
    if (String(windowName) === String(currentTab)) {
        return;
    }

    switch (windowName) {
        case "chat":
            discoveryDiv.classList.add("Hidden");
            settingsDiv.classList.add("Hidden");
            chatDiv.classList.remove("Hidden");
            socket.emit("getRoomList");
            break;

        case "rooms":
            chatDiv.classList.add("Hidden");
            settingsDiv.classList.add("Hidden");
            discoveryDiv.classList.remove("Hidden");
            socket.emit("getDiscovery");
            break;

        case "settings":
            chatDiv.classList.add("Hidden");
            discoveryDiv.classList.add("Hidden");
            settingsDiv.classList.remove("Hidden");
            break;
    
        default:
            console.log("a");
            break;
    }

    // Hvis den gamle menu var rooms, så fjern elementerne
    if (String(currentTab) === "rooms") {
        ClearRooms();
    }
    else if (String(currentTab) === "chat") {
        ClearElementOfChildren("chatList");
    }

    currentTab = String(windowName);
}

function ClearRooms() {
    const discoveryGrid = document.getElementById("discoveryGrid");

    while (discoveryGrid.firstChild) {
        discoveryGrid.removeChild(discoveryGrid.lastChild);
    }
}

function ClearElementOfChildren(elementID) {
    const element = document.getElementById(String(elementID));

    while (element.firstChild) {
        element.removeChild(element.lastChild);
    }
}

window.onload = Entry;
