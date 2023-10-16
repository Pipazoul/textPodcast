from transformers import AutoProcessor, AutoModel
import nltk
import numpy as np
import soundfile as sf

script = """
Hey, have you heard about this new text-to-audio model called "Bark"? 
Apparently, it's the most realistic and natural-sounding text-to-audio model 
out there right now. People are saying it sounds just like a real person speaking. 
I think it uses advanced machine learning algorithms to analyze and understand the 
nuances of human speech, and then replicates those nuances in its own speech output. 
It's pretty impressive, and I bet it could be used for things like audiobooks or podcasts. 
In fact, I heard that some publishers are already starting to use Bark to create audiobooks. 
It would be like having your own personal voiceover artist. I really think Bark is going to 
be a game-changer in the world of text-to-audio technology.
""".replace("\n", " ").strip()

# Split the script into sentences
sentences = nltk.sent_tokenize(script)

# Initialize the processor and model
processor = AutoProcessor.from_pretrained("suno/bark")
model = AutoModel.from_pretrained("suno/bark").to("cuda")

voice_preset = "v2/en_speaker_1"

audio_segments = []

for sentence in sentences:
    inputs = processor(
        text=sentence,
        voice_preset=voice_preset,
        return_tensors="pt",
    )
    inputs = inputs.to("cuda")
    speech_values = model.generate(**inputs, do_sample=True)

    sampling_rate = model.generation_config.sample_rate
    audio = speech_values[0].cpu().numpy().astype(np.int16)

    audio_segments.append(audio)

# Create silence of 500ms
silence_duration = int(0.5 * sampling_rate)
silence = np.zeros((silence_duration,), dtype=np.int16)

# Stitch audio segments with silence
stitched_audio = np.concatenate([audio_segments, [silence] * (len(audio_segments) - 1)])

# Save the stitched audio to a WAV file
sf.write("output_audio.wav", stitched_audio, sampling_rate)

print("Audio generated and saved as 'output_audio.wav'.")
