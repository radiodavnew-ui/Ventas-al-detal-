import zipfile
import os
import shutil

zip_path = '.build-outputs/proyecto-completo.zip'
public_zip_path = 'public/proyecto-completo.zip'
exclude_dirs = {'node_modules', '.git', '.gradle', 'build', '.build-outputs'}

os.makedirs('.build-outputs', exist_ok=True)
os.makedirs('public', exist_ok=True)

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in exclude_dirs and not d.startswith('.')]
        for file in files:
            if file.endswith('.zip') or file.startswith('.'):
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, '.')
            zipf.write(full_path, rel_path)

shutil.copyfile(zip_path, public_zip_path)

apk_source = '.build-outputs/app-debug.apk'
if os.path.exists(apk_source):
    shutil.copyfile(apk_source, 'public/app-debug.apk')

print('ZIP package ready:', zip_path, f"({os.path.getsize(zip_path)} bytes)")
print('Public ZIP ready:', public_zip_path, f"({os.path.getsize(public_zip_path)} bytes)")

