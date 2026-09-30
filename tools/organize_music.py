import hashlib
import json
import re
import shutil
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, simpledialog


AUDIO_SUFFIX = ".mp3"


def natural_sort_key(value):
    return [int(part) if part.isdigit() else part.casefold() for part in re.split(r"(\d+)", str(value))]


def clean_component(value):
    value = re.sub(r"[\x00-\x1f<>:\"/\\|?*]", "_", value)
    return re.sub(r"\s+", " ", value).strip(" .") or "Unknown"


def track_metadata(file_path, fallback_artist=""):
    name = file_path.name
    while name.lower().endswith(AUDIO_SUFFIX):
        name = name[:-len(AUDIO_SUFFIX)]
    name = name.strip()
    name = re.sub(r"^\s*\d+\s*(?:[-_.]\s*|\s+)", "", name)

    parts = re.split(r"\s+-\s+", name, maxsplit=1)
    if len(parts) == 2:
        artist, title = parts[0].strip(), parts[1].strip()
    else:
        artist, title = fallback_artist.strip() or "Unknown artist", name.strip()

    return artist or fallback_artist.strip() or "Unknown artist", title or name or file_path.stem


def sha256_file(file_path):
    digest = hashlib.sha256()
    with file_path.open("rb") as audio_file:
        for chunk in iter(lambda: audio_file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def is_inside(path, parent):
    try:
        path.resolve().relative_to(parent.resolve())
        return True
    except ValueError:
        return False


def unique_filename(output_dir, filename, reserved):
    candidate = filename
    stem = Path(filename).stem
    suffix = Path(filename).suffix
    number = 2
    while candidate.casefold() in reserved or (output_dir / candidate).exists():
        candidate = f"{stem} ({number}){suffix}"
        number += 1
    reserved.add(candidate.casefold())
    return candidate


def organize_music(source_dir, station_name, fallback_artist, license_name, source_url, license_url):
    source_dir = Path(source_dir).resolve()
    station_name = clean_component(station_name)
    project_dir = Path(__file__).resolve().parent.parent
    output_dir = project_dir / "stations" / station_name

    if not source_dir.is_dir():
        raise ValueError("A pasta de origem selecionada nao existe.")
    if source_dir == output_dir.resolve() or is_inside(source_dir, output_dir):
        raise ValueError("A pasta de destino nao pode ser a origem nem uma pasta pai dela.")

    audio_files = [
        item for item in source_dir.rglob("*")
        if item.is_file()
        and item.suffix.lower() == AUDIO_SUFFIX
        and not is_inside(item, output_dir)
    ]
    audio_files.sort(key=lambda item: natural_sort_key(item.relative_to(source_dir)))
    if not audio_files:
        raise ValueError("Nenhum arquivo MP3 foi encontrado na pasta selecionada.")

    if output_dir.exists() and any(output_dir.iterdir()):
        raise FileExistsError(f"A pasta de destino nao esta vazia: {output_dir}")
    output_dir.mkdir(parents=True, exist_ok=True)

    tracks = []
    report_lines = [
        "MEGAzFM Music Organizer",
        "=======================",
        f"Origem: {source_dir}",
        f"Destino: {output_dir}",
        f"Arquivos MP3 encontrados: {len(audio_files)}",
        "Os arquivos originais nao foram modificados.",
        "",
        "FAIXAS COPIADAS",
        "---------------",
    ]
    reserved_names = set()

    for index, source_file in enumerate(audio_files, start=1):
        artist, title = track_metadata(source_file, fallback_artist)
        base_name = f"{index:03d} - {clean_component(artist)} - {clean_component(title)}.mp3"
        output_name = unique_filename(output_dir, base_name, reserved_names)
        output_file = output_dir / output_name
        shutil.copy2(source_file, output_file)

        tracks.append({
            "index": index,
            "title": f"{artist} - {title}",
            "artist": artist,
            "file": output_name,
            "source_name": source_file.name,
            "source_path": source_file.relative_to(source_dir).as_posix(),
            "sha256": sha256_file(output_file),
            "license": license_name.strip() or "Nao verificada",
            "license_url": license_url.strip(),
            "source_url": source_url.strip(),
        })
        report_lines.append(f"COPIADA: {source_file.relative_to(source_dir)} -> {output_name}")

    playlist = {
        "name": station_name,
        "version": 1,
        "tracks": tracks,
    }
    (output_dir / "playlist.json").write_text(
        json.dumps(playlist, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    credit_lines = [
        station_name,
        "",
        "As licencas foram informadas pelo usuario e devem ser verificadas.",
        "",
    ]
    for track in tracks:
        credit_lines.extend([
            f"Artista: {track['artist']}",
            f"Faixa: {track['title']}",
            f"Arquivo: {track['file']}",
            f"Fonte: {track['source_url'] or 'Nao informada'}",
            f"Licenca: {track['license']}",
            f"URL da licenca: {track['license_url'] or 'Nao informada'}",
            "",
        ])
    (output_dir / "CREDITS.txt").write_text("\n".join(credit_lines), encoding="utf-8")

    report_lines.extend([
        "",
        "RESUMO",
        "------",
        f"Copiadas: {len(tracks)}",
        "Erros: 0",
        "Os arquivos originais nao foram modificados.",
    ])
    (output_dir / "ORGANIZER_REPORT.txt").write_text("\n".join(report_lines) + "\n", encoding="utf-8")
    return output_dir, len(tracks)


def main():
    root = tk.Tk()
    root.withdraw()

    source = filedialog.askdirectory(title="Selecione a pasta com os arquivos MP3")
    if not source:
        root.destroy()
        return

    source_path = Path(source)
    station_name = simpledialog.askstring(
        "Nome da estacao",
        "Nome da nova pasta de estacao:",
        initialvalue=source_path.name,
        parent=root,
    )
    if not station_name:
        root.destroy()
        return

    fallback_artist = simpledialog.askstring(
        "Artista padrao",
        "Artista para nomes de arquivo sem artista identificado (opcional):",
        initialvalue="",
        parent=root,
    ) or ""
    license_name = simpledialog.askstring(
        "Licenca",
        "Licenca valida para estas faixas (deixe Nao verificada se nao confirmou):",
        initialvalue="Nao verificada",
        parent=root,
    )
    if license_name is None:
        root.destroy()
        return
    source_url = simpledialog.askstring(
        "URL da fonte",
        "URL da fonte ou do album (opcional):",
        initialvalue="",
        parent=root,
    ) or ""
    license_url = simpledialog.askstring(
        "URL da licenca",
        "URL com os termos da licenca (opcional):",
        initialvalue="",
        parent=root,
    ) or ""

    try:
        output_dir, count = organize_music(
            source,
            station_name,
            fallback_artist,
            license_name,
            source_url,
            license_url,
        )
    except Exception as error:
        messagebox.showerror("Organizador de musicas", str(error), parent=root)
        root.destroy()
        return

    messagebox.showinfo(
        "Organizador de musicas",
        f"{count} arquivos MP3 organizados.\n\nDestino: {output_dir}",
        parent=root,
    )
    root.destroy()


if __name__ == "__main__":
    main()