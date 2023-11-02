// This is called with the results from from Google's sign-in client library.
function onSignIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    // Now you can use the profile info to sign the user into your app.

    // Send the ID token to your server with an AJAX call
    var id_token = googleUser.getAuthResponse().id_token;
    
    fetch('/glogin', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token: id_token })
    })
    .then((response) => response.json())
    .then((data) => {
        // Handle the response from your backend
        console.log(data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
}

function signOut() {
    var auth2 = gapi.auth2.getAuthInstance();
    auth2.signOut().then(function () {
        console.log('User signed out.');
    });
}

// Ensure the global client ID is used to initialize the Google auth client
function initGoogleAuth() {
    gapi.load('auth2', function() {
        gapi.auth2.init({
            client_id: googleClientId
        });
    });
}

// Call the init function when the window loads
window.onload = function() {
    initGoogleAuth();
};