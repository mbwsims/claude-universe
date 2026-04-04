"""Deliberately shallow tests for testkit to analyze."""
import pytest
from .utils import format_name, validate_email


def test_format_name():
    result = format_name("Alice", "Smith")
    assert result is not None  # shallow assertion — testkit should flag


def test_validate_email():
    assert validate_email("user@example.com")  # bare assert — testkit should flag


def test_validate_email_invalid():
    assert not validate_email("not-an-email")
