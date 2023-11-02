import json
from flask import Flask, render_template

app = Flask(__name__)

# Load client secrets
with open('client_secret.json') as f:
    client_secrets = json.load(f)

@app.route('/')
def login():
    # Pass the client ID to the template
    return render_template('login.html', client_id=client_secrets['web']['client_id'])

@app.route('/login', methods=['POST'])
def traditional_login():
    email = request.form['email']
    password = request.form['password']
    # Here you would implement the logic to check the user credentials
    return jsonify({'status': 'success', 'message': 'Logged in successfully'})

@app.route('/glogin', methods=['POST'])
def google_login():
    # ... your existing code ...

    auth_code = request.json.get('code')

    # Exchange auth code for access token, refresh token, and ID token
    credentials = {
        'code': auth_code,
        'client_id': client_secrets['web']['client_id'],
        'client_secret': client_secrets['web']['client_secret'],
        'redirect_uri': 'postmessage',
        'grant_type': 'authorization_code'
    }

    # POST request to Google's token URI
    r = requests.post(client_secrets['web']['token_uri'], data=credentials)
    token_response = r.json()

if __name__ == '__main__':
    app.run(debug=True)