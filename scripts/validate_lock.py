import json
for filename in ['package-lock.json']:
    path = filename
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f'{filename}: OK, packages count {len(data.get("packages", {}))}')
    except Exception as e:
        print(f'{filename}: parse error {e}')
