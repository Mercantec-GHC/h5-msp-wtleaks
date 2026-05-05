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

const chatMembersList = document.getElementById("chatMembersList");
const chatInput = document.getElementById("chatMessageInput");
const chatLogContainer = document.getElementById("chatLogContainer");
let chatLog = null;

const chatDiv = document.getElementById("chatDiv");
const discoveryDiv = document.getElementById("discoveryDiv");
const settingsDiv = document.getElementById("settingsDiv");

const chatroomFormPrivateToggle = document.getElementById("createChatroomPrivateToggle");

let thisUser = null;

let knownExternalUsers = [];
let cachedRoomIDs = [];

// ID på element i brugerliste hvor en dropdown er åben
let activeUserDropdown = -1;

let currentTab = "";
let currentRoomID = -1;
let currentRoom = null;

let discoveryRoomsIDs = [];
let discoveryFilterMember = true;

socket.on("goToLogin", () => {
    window.open("/login", "_self");
});

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

socket.on("messageDeleted", (messageID, notice) => {
    OnMessageDeleted(messageID, notice);
});

socket.on("userLeft", (userID) => {
    OnUserLeaveChatroom(userID);
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
        cachedRoomIDs = callback.payload.rooms_id;
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
    cachedRoomIDs.push(roomID);
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

        message.id = "msgid" + messages[i].id;

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

        if (messages[i].status === "ok") {
            AppendMessageHoverMenu(message, messages[i].id, messages[i].sender_id);
        }
        else {
            msg.classList.add("Removed");
        }

        /*
        let ddContext = document.createElement("button");

        let ddcIcon = document.createElement("i");
        ddcIcon.classList.add("material-icons");
        ddcIcon.innerText = "menu";
        ddContext.appendChild(ddcIcon);

        dropdown.appendChild(ddContext);
        */

        

        /*
        message.addEventListener("contextmenu", function(event) {
            event.preventDefault();
            GenerateMessageContextMenu(messages[i]);
        }, false);
        */

        chatLog.appendChild(message);
    }

    chatLogContainer.appendChild(chatLog);

    BuildChatroomUserList(room.members);
}

function AppendMessageHoverMenu(messageElement, messageID, senderID) {
    if (senderID === thisUser.ID || currentRoom.owner_id === thisUser.ID) {
        let dropdown = document.createElement("div");
        dropdown.classList.add("ChatMessageDropdown");

        let ddDelete = document.createElement("button");
        ddDelete.onclick = function () {
            DeleteMessage(currentRoomID, messageID);
        };

        let dddIcon = document.createElement("i");
        dddIcon.classList.add("material-icons");
        dddIcon.innerText = "close";
        ddDelete.appendChild(dddIcon);

        dropdown.appendChild(ddDelete);
        messageElement.appendChild(dropdown);
    }
}

function GenerateMessageContextMenu(message) {
    let menu = document.createElement("div");
    menu.classList.add("MessageContextMenu");
}

async function GetUnknownUserInfo(userID) {
    const callback = await socket.emitWithAck("getUserInfo", userID);

    const newUser = new User(userID, callback.payload.username, callback.payload.display_name);
    knownExternalUsers.push(newUser);

    return callback;
}

function BuildChatroomUserList(users) {
    ClearElementOfChildren("chatMembersList");

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        
        AddUserToChatroomList(user);
    }
}

function AddUserToChatroomList(user) {
    let userListing = document.createElement("div");
    userListing.id = "usrid" + user.id;
    userListing.classList.add("ChatMembersListing");

    let button = document.createElement("button");
    button.innerText = user.display_name;
    button.onclick = function () { ToggleChatroomUserBioSmall(user.id) };
    userListing.appendChild(button);


    let bio = document.createElement("div");
    bio.classList.add("UserListDropdown");
    bio.classList.add("Hidden");

    if (currentRoom.owner_id === thisUser.ID && user.id !== thisUser.ID) {
        let bioKick = document.createElement("button");
        bioKick.innerText = "Kick";
        bioKick.onclick = function () {
            KickUser(currentRoomID, user.id);
        };

        bio.appendChild(bioKick);
    }
    
    userListing.appendChild(bio);



    chatMembersList.appendChild(userListing);
}

function ToggleChatroomUserBioSmall(userID) {
    if (activeUserDropdown === userID) {
        const element = document.getElementById("usrid" + userID);
        element.children[1].classList.add("Hidden");

        activeUserDropdown = -1;
    }
    else if (activeUserDropdown !== -1) {
        const oldElement = document.getElementById("usrid" + activeUserDropdown);
        oldElement.children[1].classList.add("Hidden");

        const element = document.getElementById("usrid" + userID);
        element.children[1].classList.remove("Hidden");

        activeUserDropdown = userID;
    }
    else {
        const element = document.getElementById("usrid" + userID);
        element.children[1].classList.remove("Hidden");

        activeUserDropdown = userID;
    }
}

function KickUser(roomID, userID) {
    socket.emit("kickUser", roomID, userID);
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

// Når der modtages en ny besked i det nuværende chatrum
function OnNewMessageInChatroom(message) {
    currentRoom.messages.push(message);

    let newMessage = document.createElement("div");
    newMessage.classList.add("ChatMessage");
    //newMessage.setAttribute("msgid", String(message.id));
    newMessage.id = "msgid" + message.id;

    // Opret et lookup table til brugernavne, når brugeren deltager i et rum, og referér derefter dertil
    const uindex = currentRoom.members.findIndex(u => u.id === message.sender_id);
    const msgUsername = currentRoom.members[uindex].display_name;

    let name = document.createElement("span");
    name.innerText = msgUsername;
    name.classList.add("ChatMessageName");
    newMessage.appendChild(name);

    let msg = document.createElement("span");
    msg.innerText = message.content;
    msg.classList.add("ChatMessageContent");
    newMessage.appendChild(msg);

    AppendMessageHoverMenu(newMessage, message.id, message.sender_id);

    chatLog.appendChild(newMessage);
}

function OnNewUserJoinedChatroom(userID, userInfo) {
    let newUser = Object.create(null);

    newUser.id = userID;
    newUser.username = userInfo.username;
    newUser.display_name = userInfo.display_name;

    currentRoom.members.push(newUser);

    AddUserToChatroomList(newUser);
}

function OnUserLeaveChatroom(userID) {
    const uIndex = currentRoom.members.findIndex(u => u.id === userID);

    if (uIndex !== -1) {
        currentRoom.members.splice(uIndex, 1);
    }

    const element = document.getElementById("usrid" + userID);
    if (element) {
        element.parentElement.removeChild(element);
    }

    if (activeUserDropdown === userID) {
        activeUserDropdown = -1;
    }
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

function DeleteMessage(roomID, messageID) {
    if (confirm("Er du sikker på, at du vil slette denne besked?") === true) {
        socket.emit("deleteMessage", roomID, messageID);
    }
}

function OnMessageDeleted(messageID, notice) {
    const mIndex = currentRoom.messages.findIndex(m => m.id === messageID);
    console.log(mIndex);

    if (mIndex !== -1) {
        currentRoom.messages[mIndex].content = notice;
    }

    let message = document.getElementById("msgid" + messageID);
    let span = message.children[1];
    span.innerText = notice;
    span.classList.add("Removed");

    if (message.children.length === 3) {
        message.removeChild(message.lastChild);
    }
}


// ========== Discovery ==========

function OnReceiveDiscovery(rooms) {
    discoveryRoomsIDs = [];
    UpdateFilterMemberRooms();

    console.log(rooms);

    for (let i = 0; i < rooms.length; i++) {
        discoveryRoomsIDs.push(rooms[i].id);

        let box = document.createElement("div");
        box.id = "disid" + rooms[i].id;
        box.classList.add("DiscoveryShowcaseBox");
        
        let name = document.createElement("span");
        name.innerText = String(rooms[i].name);
        box.appendChild(name);

        let button = document.createElement("button");
        button.innerText = "Deltag";
        button.onclick = function() { TryJoinPublicChatroom(rooms[i].id) };
        box.appendChild(button);

        if (cachedRoomIDs.includes(rooms[i].id)) {
            button.disabled = true;

            if (discoveryFilterMember) {
                box.classList.add("Hidden");
            }
        }

        discoveryGrid.appendChild(box);
    }
}

function UpdateFilterMemberRooms() {
    const showCheck = document.getElementById("discoveryShowMember");

    if (showCheck.checked) {
        discoveryFilterMember = false;
    }
    else {
        discoveryFilterMember = true;
    }
}

function ToggleFilterMemberRooms() {
    UpdateFilterMemberRooms();
    FilterMemberRooms();
}

function FilterMemberRooms() {
    let filteredArray = cachedRoomIDs.filter(id => discoveryRoomsIDs.includes(id));

    for (let i = 0; i < filteredArray.length; i++) {
        const element = document.getElementById("disid" + filteredArray[i]);

        if (discoveryFilterMember) {
            element.classList.add("Hidden");
        }
        else {
            element.classList.remove("Hidden");
        }
    }
}

function TryJoinPublicChatroom(roomID) {
    socket.emit("tryJoinRoom", thisUser.ID, roomID, "");
}

// Eventuelt gør async med ack
function TryJoinPrivateChatroom() {
    const roomID = document.getElementById("joinChatroomID");
    const password = document.getElementById("joinChatroomPassword");

    socket.emit("tryJoinRoom", thisUser.ID, roomID.value, password.value);
}


// ========== Creating chatrooms ==========

function ToggleFormPassword() {
    const passwordField = document.getElementById("createChatroomPassword");
    
    if (chatroomFormPrivateToggle.checked) {
        passwordField.removeAttribute("disabled");
    }
    else {
        passwordField.setAttribute("disabled", "");
    }
}

function TryCreateChatroom() {
    const nameField = document.getElementById("createChatroomName");
    const passwordField = document.getElementById("createChatroomPassword");
    const privateCheck = document.getElementById("createChatroomPrivateToggle");

    const roomName = nameField.value;
    let roomPassword = "";
    let roomIsPrivate = false;

    if (privateCheck.checked) {
        roomIsPrivate = true;
        roomPassword = passwordField.value;
    }

    if (roomIsPrivate) {
        if (roomPassword !== "") {
            socket.emit("tryCreateChatroom", thisUser.ID, roomName, roomPassword, roomIsPrivate);
        }
        else {
            alert("Kan ikke oprette privat rum uden kode");
        }
    }
    else {
        socket.emit("tryCreateChatroom", thisUser.ID, roomName, "", roomIsPrivate);
    }
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
