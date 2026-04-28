var socket = io();

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

const loginUNInput = document.getElementById("loginUsername");
const loginPWInput = document.getElementById("loginPassword");

const regUNInput = document.getElementById("registerUsername");
const regDNInput = document.getElementById("registerDisplayname");
const regPWInput = document.getElementById("registerPassword");

let formState = 0;

socket.on("ServerMessage", (message) => {
    OnServerMessage(message);
});

function OnServerMessage(message) {
    alert(message);
}

function SwapForms() {
    if (!Number(formState)) {
        loginForm.classList.add("Hidden");
        registerForm.classList.remove("Hidden");
    }
    else {
        registerForm.classList.add("Hidden");
        loginForm.classList.remove("Hidden");
    }

    formState = 1 - Number(formState);
}

async function TryLogIn() {
    const un = loginUNInput.value;
    const pw = loginPWInput.value;

    if (!un || !pw) {
        alert("Udfyld venligst alle felter");
        return;
    }

    try {
        const callback = await socket.emitWithAck("tryLogin", un, pw);

        console.log(callback);

        if (callback.status !== "OK") {
            alert("Forkert brugernavn eller adgangskode");
        }
        else {
            alert("Logget ind!");
        }
    }
    catch (error) {
        console.error(error);
        alert("Ukendt loginfejl");
    }
}

async function TryRegister() {
    const un = regUNInput.value;
    const dn = regDNInput.value;
    const pw = regPWInput.value;

    if (!un || !dn || !pw) {
        alert("Udfyld venligst alle felter");
        return;
    }
    
    try {
        const callback = await socket.emitWithAck("tryRegister", un, dn, pw);

        console.log(callback);

        if (callback.status !== "OK") {
            alert(callback.payload.message);
        }
        else {
            alert("Bruger oprettet!");
            SwapForms();
        }
    }
    catch (error) {
        console.error(error);
        alert("Ukendt registreringsfejl");
    }
}
