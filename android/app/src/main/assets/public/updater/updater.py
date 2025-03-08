import time
from dotenv import load_dotenv
import os
from menu_processor_online import get_current_menus  # Assumed to be a valid import
from datetime import datetime

class Var:
    def __init__(self, name, declaration_type, assigned_object_inline_text):
        self.name = name
        self.declaration_type = declaration_type
        self.assigned_object_inline_text = assigned_object_inline_text

def edit_variables(file_content, new_vars):
    lines = file_content.split("\n")
    updated_lines = []
    var_names = [var.name for var in new_vars]

    for line in lines:
        updated = False
        for var in new_vars:
            if f"export var {var.name}" in line:
                if var.name == "menusText":
                    updated_lines.append(f"export var {var.name}: BehaviorSubject<string[]> = {var.assigned_object_inline_text}")
                else:
                    updated_lines.append(f"export var {var.name} = {var.assigned_object_inline_text}")
                updated = True
                break
        if not updated:
            if any(var_name in line for var_name in var_names):
                continue  # Skip lines with old variable values
            updated_lines.append(line)

    return "\n".join(updated_lines)

def update_local_file(file_path, new_content):
    with open(file_path, 'w', encoding='utf-8') as file:
        file.write(new_content)

def main(freq, file_path):
    # Load environment variables from .env file
    load_dotenv()

    while True:
        # Get current date and time
        current_date = datetime.now()
        # Format the date and time to exclude microseconds
        formatted_date = current_date.strftime("%Y-%m-%d %H:%M:%S")

        vars = []
        menus = get_current_menus()
        menus_var = Var("menusText", "var", f'new BehaviorSubject<string[]>({str(menus)});')
        time_var = Var("last_update_datetime", "var", f'"{formatted_date}";')
        vars.append(menus_var)
        vars.append(time_var)

        # Read file content from local file
        with open(file_path, 'r', encoding='utf-8') as file:
            file_content = file.read()

        new_content = edit_variables(file_content, vars)

        # Update the local file
        update_local_file(file_path, new_content)

        print(f"File updated at {time.ctime()}")

        time.sleep(freq)

# Get the directory of the current script
current_directory = os.path.dirname(os.path.realpath(__file__))

# Construct the relative path to the JavaScript file
relative_path = os.path.join("..", "..", "src", "app", "menu.ts")

# Construct the absolute path to the JavaScript file
file_path = os.path.abspath(os.path.join(current_directory, relative_path))

freq = 14400

# Run the main function
main(freq, file_path)
