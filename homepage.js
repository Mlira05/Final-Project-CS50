// main.js
document.addEventListener('DOMContentLoaded', (event) => {
    // Suppose you have a function to check if the user is logged in
    if (userIsLoggedIn()) {
        window.location.href = 'homepage.html'; // Redirect to the homepage
    }
});

function userIsLoggedIn() {
    // You would check your authentication state here
    // For now, we'll just return a placeholder value
    return true;
}