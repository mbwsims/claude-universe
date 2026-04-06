from flask import Flask, request, jsonify
from .models import UserModel
from .utils import validate_email

app = Flask(__name__)


@app.route("/users", methods=["POST"])
def create_user():
    """No auth decorator — shieldkit should detect missing auth."""
    data = request.get_json()
    if not validate_email(data.get("email", "")):
        return jsonify({"error": "Invalid email"}), 400
    user = UserModel.create(data["email"], data["name"])
    return jsonify(user), 201


@app.route("/users/<user_id>", methods=["GET"])
def get_user(user_id):
    """No auth decorator — shieldkit should detect missing auth."""
    user = UserModel.find_by_id(user_id)
    if not user:
        return jsonify({"error": "Not found"}), 404
    return jsonify(user)


@app.route("/admin/users", methods=["DELETE"])
def delete_all_users():
    """Dangerous admin endpoint with no auth."""
    UserModel.delete_all()
    return jsonify({"status": "deleted"}), 200
