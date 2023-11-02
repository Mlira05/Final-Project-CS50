from flask import Flask, request, jsonify, render_template
import requests

app = Flask(__name__)

# Assuming you have a User model and a database setup
# from your_project import User, db

@app.route('/')
def login():
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def traditional_login():
    email = request.form['email']
    password = request.form['password']
    # Here you would implement the logic to check the user credentials
    return jsonify({'status': 'success', 'message': 'Logged in successfully'})

@app.route('/glogin', methods=['POST'])
def google_login():
    # Validate the Google token on the server side
    token = request.json.get('token')
    # Normally you would validate the token and find or create a user in your own db
    # For example:
    # user = User.query.filter_by(email=email).first()
    # if not user:
    #     user = User(email=email)
    #     db.session.add(user)
    #     db.session.commit()
    # return user info or a session token as needed
    return jsonify({'status': 'success', 'message': 'Logged in with Google successfully'})

if __name__ == '__main__':
    app.run(debug=True)