import hashlib
import json
import logging
import os
from typing import Dict, List, Tuple

from PyPDF2 import PdfReader


def count_pdf_pages(pdf_path: str) -> int | None:
    """
    Counts the number of pages in a PDF file using PyPDF2.

    Args:
        pdf_path (str): The path to the PDF file.
    Returns:
        int | None: The number of pages in the PDF, or None if an error occurs.
    """
    try:
        with open(pdf_path, "rb") as file:
            reader = PdfReader(file)
            return len(reader.pages)
    except Exception as e:
        print(f"Error: {e}")
        return None


def list_files(folder: str, extension: str) -> List[str]:
    """
    Lists all files in the given folder with the specified extension.

    Args:
        folder (str): The path to the folder.
        extension (str): The file extension to filter by.
    Returns:
        List[str]: A list of file paths that match the given extension.
    Raises:
        ValueError: If the provided path is not a directory.
    """
    if not os.path.isdir(folder):
        raise ValueError(f"The provided path '{folder}' is not a directory.")

    return [os.path.join(folder, f) for f in os.listdir(folder) if f.endswith(extension)]


def generate_hash(text: str, length: int) -> str:
    """
    Generates a hash value of the specified length from the given text.

    Args:
        text (str): The input string to be hashed.
        length (int): The length of the resulting hash.

    Returns:
        str: A hash value of the specified length.
    """
    full_hash = hashlib.sha256(text.encode()).hexdigest()
    short_hash = full_hash[:length]
    return short_hash


def combine_filename_page_number(filename: str, page_number: int) -> str:
    """
    Combines a filename and page number into a single formatted string.

    Args:
        filename (str): The name of the file (should not include the path).
        page_number (int): The page number within the file (non-negative).

    Returns:
        str: A combined name for filename and page number.
    """
    if not isinstance(filename, str):
        raise ValueError("Filename must be a string.")
    if not isinstance(page_number, int) or page_number < 0:
        raise ValueError("Page number must be a non-negative integer.")

    if not filename.lower().endswith(".pdf"):
        filename += ".pdf"
    return f"{filename}-{page_number}"


def split_filename_page_number(combined_string: str) -> tuple[str, int]:
    """
    Splits a combined string back into the filename and page number.

    Args:
        combined_string (str): The combined string in the format 'filename-page_number'.

    Returns:
        tuple: A tuple containing the filename (str) and the page number (int).

    Raises:
        ValueError: If the combined string is not in the expected format.
    """
    if not isinstance(combined_string, str):
        raise ValueError("Combined string must be a string.")

    # Check if the format is correct
    if "-" not in combined_string:
        raise ValueError("Combined string does not contain a valid separator '-'.")

    # Split the string into filename and page_number
    *filename_parts, page_number_str = combined_string.rsplit("-", 1)

    if not filename_parts or not page_number_str.isdigit():
        raise ValueError("Combined string is not in the expected format 'filename-page_number'.")

    # Join the filename parts in case the filename contained hyphens
    filename = "-".join(filename_parts)
    page_number = int(page_number_str)

    return filename, page_number


def generate_doc_id(filename: str, page_number: int, length: int = 8) -> str:
    """
    Generates a unique document ID for a given filename and page number.

    Args:
        filename (str): The name of the file.
        page_number (int): The page number within the file.
        length (int, optional): The length of the hash. Defaults to 8.

    Returns:
        str: A short unique document ID.
    """
    unique_string = combine_filename_page_number(filename, page_number)
    return generate_hash(unique_string, length)


def generate_query_id(query: str, length: int = 5) -> str:
    """
    Generates a unique query ID based on the given query.

    Args:
        query (str): The query string for which the ID is generated.
        length (int, optional): The length of the generated hash. Defaults to 5.

    Returns:
        str: A short unique identifier for the query.
    """
    return generate_hash(query, length)


def create_doc_mapping(filenames: Dict[str, int]) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Creates mappings between "filename-page" and unique document IDs.

    Args:
        filenames (dict): A dictionary where keys are filenames (str),
            and values are the total number of pages (int).

    Returns:
        tuple: A tuple containing:
            - mapping (dict): Maps "filename-page" (str) to "doc_id" (str).
            - reverse_mapping (dict): Maps "doc_id" (str) back to "filename-page" (str).
    """
    mapping = {}
    reverse_mapping = {}

    for filename, total_pages in filenames.items():
        for page_number in range(1, total_pages + 1):
            key = combine_filename_page_number(filename, page_number)
            doc_id = generate_doc_id(filename, page_number)
            mapping[key] = doc_id
            reverse_mapping[doc_id] = key

    return mapping, reverse_mapping


def create_query_mapping(queries: List[str]) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Creates mappings between query and unique query IDs.

    Args:
        queries (List[str]): A list of query strings.

    Returns:
        tuple: A tuple containing:
            - mapping (dict): Maps query (str) to "query_id" (str).
            - reverse_mapping (dict): Maps "query_id" (str) back to query (str).
    """
    mapping = {}
    reverse_mapping = {}

    for query in queries:
        query_id = generate_query_id(query)
        mapping[query] = query_id
        reverse_mapping[query_id] = query

    return mapping, reverse_mapping


def save_mapping_to_file(
    mapping: Dict[str, str],
    reverse_mapping: Dict[str, str],
    mapping_file: str,
    reverse_mapping_file: str,
) -> None:
    """
    Saves the mapping and reverse mapping dictionaries to JSON files.

    Args:
        mapping (dict): The mapping dictionary to save.
        reverse_mapping (dict): The reverse mapping dictionary to save.
        mapping_file (str): Path to the file where the mapping will be saved.
        reverse_mapping_file (str): Path to the file where the reverse mapping will be saved.

    Returns:
        None
    """
    with open(mapping_file, "w") as map_file:
        json.dump(mapping, map_file, indent=2)
    with open(reverse_mapping_file, "w") as rev_map_file:
        json.dump(reverse_mapping, rev_map_file, indent=2)
    logging.info(f"Mappings saved to {mapping_file} and {reverse_mapping_file}.")


def load_mapping_from_file(
    mapping_file: str, reverse_mapping_file: str
) -> Tuple[Dict[str, str], Dict[str, str]]:
    """
    Loads mapping and reverse mapping dictionaries from JSON files.

    Args:
        mapping_file (str): Path to the file containing the mapping data.
        reverse_mapping_file (str): Path to the file containing the reverse mapping data.

    Returns:
        tuple: A tuple containing:
            - mapping (dict): Loaded mapping dictionary.
            - reverse_mapping (dict): Loaded reverse mapping dictionary.
    """
    with open(mapping_file, "r") as map_file:
        mapping = json.load(map_file)
    with open(reverse_mapping_file, "r") as rev_map_file:
        reverse_mapping = json.load(rev_map_file)
    logging.info(f"Mappings loaded from {mapping_file} and {reverse_mapping_file}.")
    return mapping, reverse_mapping
