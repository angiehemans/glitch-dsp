// Checks the backing-track player: mono on both outputs, resampling, sample-lock, end, restart, stop,
// and a preloaded next song.
// Build and run: cmake --build --preset dev --target BackingTest && <artefacts>/BackingTest

#include "../src/audio/BackingPlayer.h"

#include <cmath>
#include <cstdio>

namespace
{
    int failures = 0;

    void check (bool ok, const char* what)
    {
        if (! ok)
        {
            std::printf ("  failed: %s\n", what);
            ++failures;
        }
    }

    /** A sine at hz, seconds long, written as a 24-bit WAV. */
    juce::File writeSine (const juce::File& dir, const juce::String& name, double rate, int channels, double hz, double seconds)
    {
        const auto file = dir.getChildFile (name);
        juce::WavAudioFormat wav;
        std::unique_ptr<juce::OutputStream> stream = std::make_unique<juce::FileOutputStream> (file);
        auto writer = wav.createWriterFor (stream, juce::AudioFormatWriterOptions{}.withSampleRate (rate).withNumChannels (channels).withBitsPerSample (24));
        juce::AudioBuffer<float> buffer (channels, (int) (rate * seconds));
        for (int i = 0; i < buffer.getNumSamples(); ++i)
            for (int ch = 0; ch < channels; ++ch)
                buffer.setSample (ch, i, 0.5f * (float) std::sin (2.0 * juce::MathConstants<double>::pi * hz * i / rate));
        writer->writeFromAudioSampleBuffer (buffer, 0, buffer.getNumSamples());
        return file;
    }

    /** Zero crossings going up, per second: the pitch of a sine. */
    double pitchOf (const std::vector<float>& x, double rate)
    {
        int ups = 0, first = -1, last = -1;
        for (size_t i = 1; i < x.size(); ++i)
            if (x[i - 1] < 0 && x[i] >= 0)
            {
                ++ups;
                last = (int) i;
                if (first < 0)
                    first = (int) i;
            }
        return ups > 1 ? (ups - 1) * rate / (last - first) : 0.0;
    }
}

int main()
{
    juce::ScopedJuceInitialiser_GUI juce;
    const juce::TemporaryFile tempDir;
    const auto dir = tempDir.getFile();
    dir.createDirectory();

    constexpr double rate = 48000.0;
    constexpr int block = 512;
    const auto mono = writeSine (dir, "mono.wav", rate, 1, 440.0, 1.0);
    const auto copy = writeSine (dir, "copy.wav", rate, 1, 440.0, 1.0);
    const auto other = writeSine (dir, "cd.wav", 44100.0, 2, 220.0, 0.5); // CD rate: resampled

    glitch::BackingPlayer player;
    player.prepareToPlay (rate, block);
    check (player.load ({ mono, copy, other }).isEmpty(), "every file opens");
    check (player.getNumTracks() == 3, "three tracks");
    check (std::abs (player.getLengthSeconds() - 1.0) < 0.001, "the song is as long as its longest track");

    juce::AudioBuffer<float> buffer (glitch::BackingPlayer::maxTracks * 2, block);
    juce::MidiBuffer midi;
    std::vector<float> trackOne, trackThree;
    bool locked = true, monoOnBoth = true;

    player.play();
    for (int b = 0; b < 40; ++b) // ~0.43 s of audio, read ~3x faster than real time
    {
        player.processBlock (buffer, midi);
        juce::Thread::sleep (3); // play() only waits for the first quarter second; the rest streams
        for (int i = 0; i < block; ++i)
        {
            trackOne.push_back (buffer.getSample (0, i));
            trackThree.push_back (buffer.getSample (4, i));
            locked = locked && juce::exactlyEqual (buffer.getSample (0, i), buffer.getSample (2, i)); // the identical file
            monoOnBoth = monoOnBoth && juce::exactlyEqual (buffer.getSample (0, i), buffer.getSample (1, i));
        }
    }
    check (locked, "two tracks with the same audio stay sample-locked");
    check (monoOnBoth, "a mono track plays on both of its outputs");
    check (std::abs (pitchOf (trackOne, rate) - 440.0) < 0.5, "a 48 kHz track plays at its pitch");
    check (std::abs (pitchOf (trackThree, rate) - 220.0) < 0.5, "a 44.1 kHz track is resampled to its pitch");

    player.stop();
    const auto at = player.getPositionSeconds();
    player.processBlock (buffer, midi);
    check (std::abs (player.getPositionSeconds() - at) < 1.0e-9 && buffer.getMagnitude (0, block) < 1.0e-9f, "stopped: silent, and the position holds");

    player.restart();
    check (player.getPositionSeconds() < 1.0e-9, "restart goes back to the start");

    player.play();
    for (int b = 0; b < 100 && player.isPlaying(); ++b)
    {
        player.processBlock (buffer, midi);
        juce::Thread::sleep (2); // let the read-ahead keep up over a whole second of audio
    }
    check (! player.isPlaying(), "the song stops at its end");

    // The next song, preloaded: load() swaps it in, at its start, and it plays.
    const auto next = writeSine (dir, "next.wav", rate, 2, 330.0, 2.0);
    player.preload ({ next });
    const auto started = juce::Time::getMillisecondCounterHiRes();
    check (player.load ({ next }).isEmpty(), "the preloaded song loads");
    check (juce::Time::getMillisecondCounterHiRes() - started < 5.0, "a preloaded song loads without opening its files again");
    check (player.getNumTracks() == 1 && std::abs (player.getLengthSeconds() - 2.0) < 0.001, "it's the preloaded song");
    std::vector<float> nextOut;
    player.play();
    for (int b = 0; b < 20; ++b)
    {
        player.processBlock (buffer, midi);
        juce::Thread::sleep (3);
        for (int i = 0; i < block; ++i)
            nextOut.push_back (buffer.getSample (0, i));
    }
    check (std::abs (pitchOf (nextOut, rate) - 330.0) < 0.5, "the preloaded song plays from its start");

    // Preloading the song after it (a setlist edit mid-song) leaves the playing one alone.
    const auto before = player.getPositionSeconds();
    player.preload ({ mono, copy });
    player.processBlock (buffer, midi);
    check (player.isPlaying() && player.getPositionSeconds() > before, "preloading keeps the current song playing");

    std::printf (failures == 0 ? "backing: ok\n" : "backing: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}
