# test.py
from TTS.api import TTS
import sys
import soundfile as sf
import io
import warnings

warnings.filterwarnings("ignore", category=UserWarning)

text = sys.argv[1]

tts = TTS(model_name="tts_models/en/vctk/vits")

# Multi-speaker: specify speaker
wav = tts.tts(text=text, speaker="p225")

buffer = io.BytesIO()
sf.write(buffer, wav, samplerate=22050, format="WAV")

sys.stdout.buffer.write(buffer.getvalue())
sys.stdout.flush()