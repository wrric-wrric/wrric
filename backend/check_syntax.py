import ast
import sys

try:
    with open('api/user_entity_api.py', 'r') as f:
        content = f.read()
    ast.parse(content)
    print('Syntax OK')
except SyntaxError as e:
    print(f'Line {e.lineno}: {e.msg}')
    print(f'Line content: {e.text}')
    print(f'Offset: {e.offset}')
    sys.exit(1)
except Exception as e:
    print(f'Error: {e}')
    sys.exit(1)
