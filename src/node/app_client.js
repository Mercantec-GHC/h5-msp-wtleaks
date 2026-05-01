var socket = io();

class User {
    ID;
    UserName;
    DisplayName;

    constructor (id, name, displayname) {
        this.ID = id;
        this.UserName = name;
        this.DisplayName = displayname;
    }
}

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

let thisUser = null;

let knownExternalUsers = [];

let currentTab = "";
let currentRoomID = -1;

let currentRoom = null;

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

socket.on("receiveMessages", (messages) => {
    OnReceiveMessages(messages);
});

socket.on("newMessageRoom", (message) => {
    OnNewMessageInChatroom(message);
});

socket.on("redirectToRoom", (roomID) => {
    RedirectToChatroom(roomID);
});

socket.on("newUserJoined", (userID, userInfo) => {
    OnNewUserJoinedChatroom(userID, userInfo);
});


// ========== Initialisation ==========

// pt er data bare userCounter, så altid Number
function InitSessionStorage(data) {
    sessionStorage.setItem("username", "Bruger " + String(data));
}

function Entry() {
    chatInput.addEventListener("keydown", OnKeyDownChatMessageInput);
    GetOwnInfo();
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

async function GetOwnInfo() {
    const callback = await socket.emitWithAck("getOwnInfo");

    if (callback.status === "OK") {
        thisUser = new User(callback.payload.id, callback.payload.username, callback.payload.display_name);
    }
    else {
        alert("Fejl");
    }
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
        button.innerText = room.name;
        button.onclick = function () { socket.emit("tryEnterRoom", room.id) };
        roomListing.appendChild(button);

        chatList.appendChild(roomListing);
    }
}

function RedirectToChatroom(roomID) {
    ChangeActiveWindow("chat");
    socket.emit("tryEnterRoom", roomID);
}

// Selve chatrummet med beskeder, brugere, osv
async function OnReceiveChatroom(room) {
    currentRoomID = room.id;
    currentRoom = room;

    const messages = room.messages;

    if (chatLogContainer.children.length !== 0) {
        chatLogContainer.removeChild(chatLogContainer.firstChild);
    }

    chatLog = document.createElement("div");
    chatLog.classList.add("ChatLog");

    for (let i = 0; i < messages.length; i++) {
        let message = document.createElement("div");
        message.classList.add("ChatMessage");

        let userString;
        const uIndex = currentRoom.members.findIndex(u => u.id === messages[i].sender_id);

        if (uIndex !== -1) {
            userString = currentRoom.members[uIndex].display_name;
        }
        else {
            // Den skriver arrayet, selv om det gerne skulle være tomt? fundet index er stadig -1, så lidt forvirret
            //console.log(knownExternalUsers);
            const ueIndex = knownExternalUsers.findIndex(u => u.ID === messages[i].sender_id);

            if (ueIndex !== -1) {
                userString = knownExternalUsers[ueIndex].DisplayName;
            }
            else {
                const callback = await GetUnknownUserInfo(messages[i].sender_id);
                userString = callback.payload.display_name;
            }
        }

        let name = document.createElement("span");
        name.innerText = userString;
        name.classList.add("ChatMessageName");
        message.appendChild(name);

        let msg = document.createElement("span");
        msg.innerText = messages[i].content;
        msg.classList.add("ChatMessageContent");
        message.appendChild(msg);

        chatLog.appendChild(message);
    }

    chatLogContainer.appendChild(chatLog);
}

async function GetUnknownUserInfo(userID) {
    const callback = await socket.emitWithAck("getUserInfo", userID);

    const newUser = new User(userID, callback.payload.username, callback.payload.display_name);
    knownExternalUsers.push(newUser);

    return callback;
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

    // Opret et lookup table til brugernavne, når brugeren deltager i et rum, og referér derefter dertil
    const uindex = currentRoom.members.findIndex(u => u.id === message.sender_id);
    const msgUsername = currentRoom.members[uindex].username;

    let name = document.createElement("span");
    name.innerText = msgUsername;
    name.classList.add("ChatMessageName");
    newMessage.appendChild(name);

    let msg = document.createElement("span");
    msg.innerText = message.content;
    msg.classList.add("ChatMessageContent");
    newMessage.appendChild(msg);

    chatLog.appendChild(newMessage);
}

function OnNewUserJoinedChatroom(userID, userInfo) {
    let newUser = Object.create(null);

    newUser.id = userID;
    newUser.username = userInfo.username;
    newUser.display_name = userInfo.display_name;

    currentRoom.members.push(newUser);
}

function OnReceiveMessages(messages) {
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
    socket.emit("tryJoinRoom", thisUser.ID, roomID);
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
