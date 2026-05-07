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

// Skifter mellem login og registrering
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

// Forsøger på at logge brugeren ind
// Ved success modtages tokens
async function TryLogInRequest() {
    const un = loginUNInput.value;
    const pw = loginPWInput.value;

    if (!un || !pw) {
        alert("Udfyld venligst alle felter");
        return;
    }

    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            username: un,
            code: pw
        })
    };

    try {
        const response = await fetch("/login/creds", requestOptions);

        if (response.ok) {
            // Åbner siden til applikationen, hvis man kan logge ind
            window.open("/", "_self");
        }
        else {
            alert("Forkert brugernavn eller adgangskode");
        }
    }
    catch (error) {
        console.error(error);
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

// Ikke færdig
async function TryLogInRefresh() {
    const requestOptions = {
        method: "POST",
        headers: {
            "Content-type": "application/json"
        },
        body: JSON.stringify({
            refresh_token: ""
        })
    };

    try {
        const response = await fetch("/login/refresh", requestOptions);

        console.log(response);

        if (response.ok) {
            
        }
    }
    catch (error) {
        console.error(error);
    }
}

// Ikke færdig
async function TryLogOut() {
    const callback = await socket.emitWithAck("clientLogOut");

    if (callback.status === "OK") {
        alert("Logget ud!");
        //alert(callback.payload.message);
    }
    else {
        alert("Fejl");
    }
}
