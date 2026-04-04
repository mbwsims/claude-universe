import os
import subprocess


def run_command(cmd: str) -> str:
    """Run a shell command — dangerous function for shieldkit to detect."""
    return subprocess.check_output(cmd, shell=True).decode()


def execute_query(db, table: str, user_input: str) -> list:
    """SQL injection vulnerability — f-string with user input."""
    query = f"SELECT * FROM {table} WHERE name = '{user_input}'"
    return db.execute(query)


def safe_query(db, table: str, user_input: str) -> list:
    """Safe parameterized query."""
    return db.execute("SELECT * FROM users WHERE name = %s", [user_input])


def format_name(first: str, last: str) -> str:
    return f"{first.strip()} {last.strip()}"


def validate_email(email: str) -> bool:
    return "@" in email and "." in email.split("@")[1]
