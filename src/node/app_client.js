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

const chatWindowHeaderSpan = document.getElementById("chatWindowHeaderSpan");
const chatMembersList = document.getElementById("chatMembersList");
const chatInput = document.getElementById("chatMessageInput");
const chatLogContainer = document.getElementById("chatLogContainer");
let chatLog = null;

const chatDiv = document.getElementById("chatDiv");
const discoveryDiv = document.getElementById("discoveryDiv");
const settingsDiv = document.getElementById("settingsDiv");

const chatroomFormPrivateToggle = document.getElementById("createChatroomPrivateToggle");

const settingsDisplayNameInput = document.getElementById("settingsDisplayNameInput");
const settingsUserNameInput = document.getElementById("settingsUserNameInput");
const settingsPasswordInput = document.getElementById("settingsPasswordInput");

let thisUser = null;

let knownExternalUsers = [];
let cachedRoomIDs = [];

const chatroomContextMenu = document.getElementById("chatroomContextMenu");
const chatroomContextMenuName = document.getElementById("chatroomContextMenuName");
const chatroomContextMenuCopyIDButton = document.getElementById("chatroomContextMenuCopyIDButton");
const chatroomContextMenuLeaveButton = document.getElementById("chatroomContextMenuLeaveButton");
let activeChatroomContextMenuID = -1;

// ID på element i brugerliste hvor en dropdown er åben
const miniBio = document.getElementById("userMiniBio");
const miniBioDN = document.getElementById("miniBioDN");
const miniBioUN = document.getElementById("miniBioUN");
const miniBioDivider = document.getElementById("miniBioDivider");
const miniBioButtonsList = document.getElementById("miniBioButtonsList");
let activeMiniBioID = -1;

const extraMenuOffset = 3;

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

socket.on("newUserJoined", (userID, userInfo) => {
    OnNewUserJoinedChatroom(userID, userInfo);
});

socket.on("messageDeleted", (messageID, notice) => {
    OnMessageDeleted(messageID, notice);
});

socket.on("kickedFromRoom", (roomID) => {
    OnKickedFromRoom(roomID);
});

socket.on("userLeft", (userID) => {
    OnUserLeaveChatroom(userID);
});



// =============== Initialisation ===============

function Entry() {
    chatInput.addEventListener("keydown", OnKeyDownChatMessageInput);
    GetOwnInfo();
    ChangeActiveWindow("chat");
}

function OnServerMessage(message) {
    alert(message);
}



// =============== Account ===============

async function TryChangeDisplayName() {
    const input = document.getElementById("displayNameInput");
    const newName = input.value;

    const callback = await socket.emitWithAck("changeDisplayName", newName);

    if (callback.status === "OK") {
        thisUser.DisplayName = newName;

        const settingsDisplayName = document.getElementById("settingsDisplayName");
        settingsDisplayName.innerText = thisUser.DisplayName;

        alert("Navn opdateret!");
    }
    else {
        alert("Fejl");
    }
}

async function TryChangeUserInfo(type) {
    if (!confirm("Er du sikker på, at du vil ændre din information? Ved ændring vil du blive logget ud, og skal indtaste dine nye oplysninger.")) {
        return;
    }

    let newUN = "";
    let curPW = "";
    let newPW = "";
    
    if (type === "username") {
        const unInput = document.getElementById("usernameInput");
        newUN = unInput.value;
    }
    else if (type === "password") {
        const cpwInput = document.getElementById("currentPasswordInput");
        curPW = cpwInput.value;

        const npwInput = document.getElementById("newPasswordInput");
        newPW = npwInput.value;
    }

    const requestOptions = {
        method: "PATCH",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            username: newUN,
            current_password: curPW,
            new_password: newPW
        })
    };

    try {
        const response = await fetch("/user/update", requestOptions);

        if (response.ok) {
            socket.disconnect().connect();
            GetOwnInfo();
        }
        else {
            console.error(response.body);
        }
    }
    catch (error) {
        console.error(error);
    }
}

async function GetOwnInfo() {
    const callback = await socket.emitWithAck("getOwnInfo");

    if (callback.status === "OK") {
        thisUser = new User(callback.payload.id, callback.payload.username, callback.payload.display_name);
        cachedRoomIDs = callback.payload.rooms_id;

        const settingsDisplayName = document.getElementById("settingsDisplayName");
        settingsDisplayName.innerText = thisUser.DisplayName;

        const settingsUserName = document.getElementById("settingsUserName");
        settingsUserName.innerText = thisUser.UserName;
    }
    else {
        if (callback.payload.message) {
            alert(callback.payload.message);
        }
        else {
            alert("Fejl");
        }
    }
}



// =============== Chatroom ===============

// Listen af chatrum på siden
function OnReceiveChatroomList(roomList) {
    const chatList = document.getElementById("chatList");

    for (let i = 0; i < roomList.length; i++) {
        const room = roomList[i];
        
        const roomListing = document.createElement("div");
        roomListing.classList.add("ChatListing");

        const button = document.createElement("button");
        button.classList.add("LightText");
        button.id = "crlid" + room.id;
        button.innerText = room.name;

        button.onclick = function () { socket.emit("tryEnterRoom", room.id) };
        
        button.addEventListener("contextmenu", function(event) {
            event.preventDefault();
            ToggleChatroomContextMenu(room.name, room.id);
        }, false);
        
        roomListing.appendChild(button);

        chatList.appendChild(roomListing);
    }

    SetHighlightForCurrentChatroom(true);
}

// Åbner et chatrum
function RedirectToChatroom(roomID) {
    cachedRoomIDs.push(roomID);
    ChangeActiveWindow("chat");
    socket.emit("tryEnterRoom", roomID);
}

// Selve chatrummet med beskeder, brugere, osv
async function OnReceiveChatroom(room) {
    SetHighlightForCurrentChatroom(false);
    ResetMiniBio();

    currentRoomID = room.id;
    currentRoom = room;

    const messages = room.messages;

    if (chatLogContainer.children.length !== 0) {
        chatLogContainer.removeChild(chatLogContainer.firstChild);
    }

    DoShowChatFeatures(true);
    SetHighlightForCurrentChatroom(true);

    chatWindowHeaderSpan.innerText = room.name;

    chatLog = document.createElement("div");
    chatLog.classList.add("ChatLog");

    for (let i = 0; i < messages.length; i++) {
        const message = document.createElement("div");
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

        const name = document.createElement("span");
        name.innerText = userString;
        name.classList.add("ChatMessageName");
        message.appendChild(name);

        const msg = document.createElement("span");
        msg.innerText = messages[i].content;
        msg.classList.add("ChatMessageContent");
        message.appendChild(msg);

        if (messages[i].status === "ok") {
            AppendMessageHoverMenu(message, messages[i].id, messages[i].sender_id);
        }
        else {
            msg.classList.add("Removed");
        }

        chatLog.appendChild(message);
    }

    chatLogContainer.appendChild(chatLog);

    if (chatLog.children.length > 0) {
        chatLog.lastChild.scrollIntoView({ behavior: "instant", block: "end" })
    }

    BuildChatroomUserList(room.members);
}

// Til den lille menu, der dukker op, når musen er over en besked
function AppendMessageHoverMenu(messageElement, messageID, senderID) {
    if (senderID === thisUser.ID || currentRoom.owner_id === thisUser.ID) {
        const dropdown = document.createElement("div");
        dropdown.classList.add("ChatMessageDropdown");

        const ddDelete = document.createElement("button");
        ddDelete.classList.add("ChatMessageDropdownButton");
        ddDelete.classList.add("ChatMessageDropdownButtonDelete");

        ddDelete.onclick = function () {
            DeleteMessage(currentRoomID, messageID);
        };

        const dddIcon = document.createElement("i");
        dddIcon.classList.add("material-icons");
        dddIcon.innerText = "close";
        ddDelete.appendChild(dddIcon);

        dropdown.appendChild(ddDelete);
        messageElement.appendChild(dropdown);
    }
}

// WIP - til når jeg finder ud af en god løsning på at overskrive højreklik, og generelt ved, hvad jeg kunne proppe i en kontekstmenu
function GenerateMessageContextMenu(message) {
    const menu = document.createElement("div");
    menu.classList.add("MessageContextMenu");
}

// Henter information på brugere, der har skrevet beskeder i en gruppe, de ikke længere er medlem af
async function GetUnknownUserInfo(userID) {
    const callback = await socket.emitWithAck("getUserInfo", userID);

    const newUser = new User(userID, callback.payload.username, callback.payload.display_name);
    knownExternalUsers.push(newUser);

    return callback;
}

// Bygger listen med brugere i et chatrum
function BuildChatroomUserList(users) {
    ClearElementOfChildrenExceptFirst("chatMembersList");

    for (let i = 0; i < users.length; i++) {
        AddUserToChatroomUserList(users[i]);
    }
}

// Tilføjer en ny bruger til brugerlisten
function AddUserToChatroomUserList(user) {
    const userListing = document.createElement("div");
    userListing.id = "usrid" + user.id;
    userListing.classList.add("ChatMembersListing");

    const button = document.createElement("button");
    button.classList.add("ChatMembersListingButton");

    button.onclick = function () { ToggleMiniBio(user.id) };

    button.addEventListener("contextmenu", function(event) {
        event.preventDefault();
        ToggleMiniBio(user.id)
    }, false);

    const userPicture = document.createElement("div");
    userPicture.classList.add("PHCircleSmall");
    button.appendChild(userPicture);

    const userName = document.createElement("span");
    userName.classList.add("LightText");
    userName.innerText = user.display_name;
    button.appendChild(userName);

    userListing.appendChild(button);

    chatMembersList.appendChild(userListing);
}

// Når man klikker på en bruger i brugerlisten
function ToggleMiniBio(userID) {
    if (activeMiniBioID === userID) {
        miniBio.classList.add("Hidden");
        
        activeMiniBioID = -1;
        return;
    }

    UpdateMiniBio(userID);
}

function UpdateMiniBio(userID) {
    const parentElement = document.getElementById("usrid" + userID);
    const rect = parentElement.getBoundingClientRect();

    miniBio.style.top = rect.top + "px";
    miniBio.style.left = (rect.left - (194 + extraMenuOffset)) + "px";

    ClearElementOfChildren("miniBioButtonsList");

    const relevantUser = currentRoom.members.find(u => u.id === userID);

    if (relevantUser !== undefined) {
        miniBioDN.innerText = relevantUser.display_name;
        miniBioUN.innerText = "(" + relevantUser.username + ")";

        if (currentRoom.owner_id === thisUser.ID && userID !== thisUser.ID) {
            const bioKick = document.createElement("button");
            bioKick.classList.add("BtnWarn");
            bioKick.innerText = "Kick";
            bioKick.onclick = function () {
                KickUser(currentRoomID, userID);
            };

            miniBioButtonsList.appendChild(bioKick);
        }

        if (miniBioButtonsList.children.length === 0) {
            miniBioDivider.classList.add("Hidden");
            miniBioButtonsList.classList.add("Hidden");
        }
        else {
            miniBioDivider.classList.remove("Hidden");
            miniBioButtonsList.classList.remove("Hidden");
        }

        activeMiniBioID = userID;
        miniBio.classList.remove("Hidden");
    }
}

// Når man vil forsøge at forlade et chatrum
async function LeaveChatroom(roomID) {
    if (!confirm("Er du sikker på, at du vil forlade dette chatrum?")) {
        return;
    }

    const callback = await socket.emitWithAck("leaveChatroom", thisUser.ID, roomID);

    if (callback.status === "OK") {
        ResetChatroomContextMenu();
    }
    else {
        alert(callback.payload.detail);
    }
}

// Forsøger at fjerne en bruger fra et rum
function KickUser(roomID, userID) {
    socket.emit("kickUser", roomID, userID);
}

// Når man er blevet fjernet fra et chatrum
// På trods af navnet gælder dette også, når man selv forlader et chatrum
function OnKickedFromRoom(roomID) {
    const index = cachedRoomIDs.indexOf(roomID);

    if (index !== -1) {
        // Fjerner rummet fra den lokale liste til Discovery
        cachedRoomIDs.splice(index, 1);

        // Fjerner referencer fra lokal data
        const oldRoomID = currentRoomID;
        currentRoomID = -1;
        currentRoom = null;

        // Hvis rummet er åbent, gemmes elementer væk, og fjerner HTML-information om rummet som chatlogs og brugerliste
        if (oldRoomID === roomID) {
            DoShowChatFeatures(false);

            if (chatLogContainer.children.length !== 0) {
                chatLogContainer.removeChild(chatLogContainer.firstChild);
            }

            ClearElementOfChildrenExceptFirst("chatMembersList");
        }

        // Fjerner rummet fra chatlisten/opdaterer chatliste, hvis chatvinduet er åbent
        if (currentTab = "chat") {
            ClearElementOfChildrenExceptFirst("chatList");
            socket.emit("getRoomList");
        }
    }
}



// =============== Messages ===============

// Hvis tekstfeltet er i fokus, og man trykker enter, så sendes beskeden uden at man behøver at klikke på "Send"-knappen
function OnKeyDownChatMessageInput(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        SendMessageInChatroom();
    }
}

// Sender en tekstbesked til rummet
function SendMessageInChatroom() {
    if (chatInput.value) {
        socket.emit("chatMessageRoom", socket.id, currentRoomID, chatInput.value);
        chatInput.value = "";
    }
}

// Når der modtages en ny besked i det nuværende chatrum
// Tilføjer beskeden til den aktuelle chatlog
function OnNewMessageInChatroom(message) {
    currentRoom.messages.push(message);

    const newMessage = document.createElement("div");
    newMessage.classList.add("ChatMessage");
    newMessage.id = "msgid" + message.id;

    // Opret et lookup table til brugernavne, når brugeren deltager i et rum, og referér derefter dertil
    const uindex = currentRoom.members.findIndex(u => u.id === message.sender_id);
    const msgUsername = currentRoom.members[uindex].display_name;

    const name = document.createElement("span");
    name.innerText = msgUsername;
    name.classList.add("ChatMessageName");
    newMessage.appendChild(name);

    const msg = document.createElement("span");
    msg.innerText = message.content;
    msg.classList.add("ChatMessageContent");
    newMessage.appendChild(msg);

    AppendMessageHoverMenu(newMessage, message.id, message.sender_id);

    // Udregnes før elementet indsættes, så målet ikke flytter sig
    const scrollPosition = chatLogContainer.scrollTop;
    const scrollMax = chatLogContainer.scrollHeight - chatLogContainer.clientHeight;

    chatLog.appendChild(newMessage);

    //console.log("Before:   Top: " + scrollPosition + "   Max: " + scrollMax);
    //console.log("After:   Top: " + chatLogContainer.scrollTop + "   Max: " + (chatLogContainer.scrollHeight - chatLogContainer.clientHeight));
    //console.log("Result: " + (scrollMax - scrollPosition));

    // Hvis der tidligere var bladret til bund, så bladr til den nye bund
    if ((scrollMax - scrollPosition) < 1) {
        chatLog.lastChild.scrollIntoView({ behavior: "instant", block: "end" })
    }
}

// Når det nuværende chatrum får et nyt medlem. Sørger for at vise det med det samme
function OnNewUserJoinedChatroom(userID, userInfo) {
    const newUser = Object.create(null);

    newUser.id = userID;
    newUser.username = userInfo.username;
    newUser.display_name = userInfo.display_name;

    currentRoom.members.push(newUser);

    AddUserToChatroomList(newUser);
}

// Når det nuværende chatrum mister et medlem. Sørger for at vise det med det samme
function OnUserLeaveChatroom(userID) {
    const uIndex = currentRoom.members.findIndex(u => u.id === userID);

    if (uIndex !== -1) {
        currentRoom.members.splice(uIndex, 1);
    }

    const element = document.getElementById("usrid" + userID);
    if (element) {
        element.parentElement.removeChild(element);
    }

    if (activeMiniBioID === userID) {
        activeMiniBioID = -1;
    }
}

// Prøver at slette en besked
function DeleteMessage(roomID, messageID) {
    if (!confirm("Er du sikker på, at du vil slette denne besked?")) {
        return;
    }

    socket.emit("deleteMessage", roomID, messageID);
}

// Fjerner beskeden i det aktuelle chatrum
function OnMessageDeleted(messageID, notice) {
    const mIndex = currentRoom.messages.findIndex(m => m.id === messageID);

    if (mIndex !== -1) {
        currentRoom.messages[mIndex].content = notice;
    }

    const message = document.getElementById("msgid" + messageID);
    const span = message.children[1];
    span.innerText = notice;
    span.classList.add("Removed");

    if (message.children.length === 3) {
        message.removeChild(message.lastChild);
    }
}



// =============== Discovery ===============

// Når brugeren modtager listen med offentlige chatrum
function OnReceiveDiscovery(rooms) {
    discoveryRoomsIDs = [];
    UpdateFilterMemberRooms();

    //console.log(rooms);

    for (let i = 0; i < rooms.length; i++) {
        discoveryRoomsIDs.push(rooms[i].id);

        const box = document.createElement("div");
        box.id = "disid" + rooms[i].id;
        box.classList.add("DiscoveryShowcaseBox");
        
        const name = document.createElement("span");
        name.innerText = String(rooms[i].name);
        box.appendChild(name);

        const button = document.createElement("button");
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

    discoveryFilterMember = showCheck.checked ? false : true;
}

function ToggleFilterMemberRooms() {
    UpdateFilterMemberRooms();
    FilterMemberRooms();
}

function FilterMemberRooms() {
    const filteredArray = cachedRoomIDs.filter(id => discoveryRoomsIDs.includes(id));

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

// Forsøger at blive medlem af et offentligt chatrum
function TryJoinPublicChatroom(roomID) {
    socket.emit("tryJoinRoom", thisUser.ID, roomID, "");
}

// Forsøger at blive medlem af et privat chatrum
// Eventuelt gør async med ack
function TryJoinPrivateChatroom() {
    const roomID = document.getElementById("joinChatroomID");
    const password = document.getElementById("joinChatroomPassword");

    socket.emit("tryJoinRoom", thisUser.ID, roomID.value, password.value);
}



// =============== Creating chatrooms ===============

// Når brugeren trykker på "Privat rum?"-knappen, gøres adgangskodefeltet forholdsvist tilgængeligt
function ToggleFormPassword() {
    const passwordField = document.getElementById("createChatroomPassword");
    
    if (chatroomFormPrivateToggle.checked) {
        passwordField.removeAttribute("disabled");
    }
    else {
        passwordField.setAttribute("disabled", "");
    }
}

// Forsøger at oprette et nyt chatrum. Hvis det lykkedes, bliver brugeren automatisk medlem, og det åbnes
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



// =============== Sidebar / GUI ===============

// Ændrer på hvilken del af applikationen, der er synlig
function ChangeActiveWindow(windowName) {
    // Åbner ikke den samme menu igen
    if (String(windowName) === String(currentTab)) {
        return;
    }

    switch (windowName) {
        case "chat":
            OpenChatWindow();
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
        ClearDiscoveryRooms();
    }
    else if (String(currentTab) === "chat") {
        ClearElementOfChildrenExceptFirst("chatList");
        ResetChatroomContextMenu();
        ResetMiniBio();
    }

    currentTab = String(windowName);
}

// Når chatvinduet åbnes. Hvis et chatrum ikke er åbent, så vises visse elementer ikke
function OpenChatWindow() {
    discoveryDiv.classList.add("Hidden");
    settingsDiv.classList.add("Hidden");

    if (currentRoomID === -1) {
        DoShowChatFeatures(false);
    }

    ClearElementOfChildrenExceptFirst("chatList");

    chatDiv.classList.remove("Hidden");
    socket.emit("getRoomList");
}

// Gør chatlog, chatinput og brugerliste synlige eller usynlige efter behov
function DoShowChatFeatures(bValue) {
    const chatWindow = document.getElementById("chatWindow");
    const chatMembersList = document.getElementById("chatMembersList");

    if (bValue) {
        chatWindow.classList.remove("Hidden");
        chatMembersList.classList.remove("Hidden");
    }
    else {
        chatWindow.classList.add("Hidden");
        chatMembersList.classList.add("Hidden");
    }
}

// Hjælper med at indikere hvilket af brugerens chatrum, de har åbent
function SetHighlightForCurrentChatroom(bValue) {
    if (currentRoomID === -1) {
        return;
    }

    const element = document.getElementById("crlid" + currentRoomID);

    if (element) {
        if (bValue) {
            element.classList.add("CurrentChat");
        }
        else {
            element.classList.remove("CurrentChat");
        }
    }
}

function ToggleSettingsInput(name) {
    let element;

    switch (name) {
        case "displayname":
            element = settingsDisplayNameInput;
            break;

        case "username":
            element = settingsUserNameInput;
            break;

        case "password":
            element = settingsPasswordInput;
            break;
    
        default:
            break;
    }

    if (element.classList.contains("Hidden")) {
        element.classList.remove("Hidden");
    }
    else {
        element.classList.add("Hidden");
    }
}

function ToggleChatroomContextMenu(roomName, roomID) {
    if (activeChatroomContextMenuID === roomID) {
        chatroomContextMenu.classList.add("Hidden");
        
        activeChatroomContextMenuID = -1;
        return;
    }

    UpdateChatroomContextMenu(roomName, roomID);
    activeChatroomContextMenuID = roomID;
    chatroomContextMenu.classList.remove("Hidden");
}

function UpdateChatroomContextMenu(roomName, roomID) {
    const parentElement = document.getElementById("crlid" + roomID);
    const rect = parentElement.getBoundingClientRect();

    chatroomContextMenu.style.top = rect.top + "px";
    chatroomContextMenu.style.left = (rect.right + 5 + extraMenuOffset) + "px";

    chatroomContextMenuName.innerText = roomName;

    chatroomContextMenuCopyIDButton.onclick = async function () {
        try {
            await navigator.clipboard.writeText(roomID);
        }
        catch (error) {
            console.error(error);
        }
    };

    chatroomContextMenuLeaveButton.onclick = function () {
        LeaveChatroom(roomID);
    };
}

function ResetMiniBio() {
    activeMiniBioID = -1;
    miniBio.classList.add("Hidden");
}

function ResetChatroomContextMenu() {
    activeChatroomContextMenuID = -1;
    chatroomContextMenu.classList.add("Hidden");
}

// Fjerner alle de offentlige rum fra Discovery
function ClearDiscoveryRooms() {
    const discoveryGrid = document.getElementById("discoveryGrid");

    while (discoveryGrid.firstChild) {
        discoveryGrid.removeChild(discoveryGrid.lastChild);
    }
}

// Hjælpefunktion til at fjerne alle børn fra et HTML-element
function ClearElementOfChildren(elementID) {
    const element = document.getElementById(String(elementID));

    while (element.firstChild) {
        element.removeChild(element.lastChild);
    }
}

function ClearElementOfChildrenExceptFirst(elementID) {
    const element = document.getElementById(String(elementID));

    while (element.children.length > 1) {
        element.removeChild(element.lastChild);
    }
}

window.onload = Entry;
