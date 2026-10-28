// Checks the tuner's pitch detection on known pitches, within half a cent.
// Build and run: cmake --build --preset dev --target TunerTest && <artefacts>/TunerTest

#include "../src/audio/Tuner.h"

#include <cmath>
#include <cstdio>
#include <random>
#include <vector>

int main()
{
    constexpr double rate = 48000.0;
    constexpr int n = 4096;
    int failures = 0;

    const auto check = [&] (const char* what, const std::vector<float>& x, float expected)
    {
        const auto got = glitch::detectPitch (x.data(), n, rate);
        const auto cents = expected > 0 && got > 0 ? 1200.0 * std::log2 (got / expected) : 0.0;
        const auto ok = expected <= 0 ? got <= 0 : got > 0 && std::abs (cents) < 0.5;
        if (! ok)
        {
            std::printf ("  %s: got %.3f Hz, expected %.3f Hz (%.2f cents)\n", what, got, expected, cents);
            ++failures;
        }
    };
    const auto tone = [&] (double hz, bool saw)
    {
        std::vector<float> x (n);
        for (int i = 0; i < n; ++i)
        {
            // The saw is band-limited (harmonics up to a quarter of the rate, falling as 1/k), like a
            // plucked string through an amp; a naive one's jump has no real instrument behind it.
            const auto t = 2.0 * juce::MathConstants<double>::pi * hz * i / rate;
            double v = 0;
            for (int k = 1; k <= (saw ? (int) (rate / 4 / hz) : 1); ++k)
                v += std::sin (k * t) / k;
            x[(size_t) i] = (float) (0.4 * v);
        }
        return x;
    };

    for (const auto hz : { 30.87, 41.20, 82.41, 110.0, 146.83, 196.0, 246.94, 329.63, 440.0, 445.3, 987.77 })
    {
        check ("sine", tone (hz, false), (float) hz);
        check ("band-limited sawtooth (rich harmonics)", tone (hz, true), (float) hz);
    }

    check ("silence", std::vector<float> (n), 0.0f);
    std::vector<float> noise (n);
    std::mt19937 gen (1);
    std::uniform_real_distribution<float> dist (-0.5f, 0.5f);
    for (auto& s : noise)
        s = dist (gen);
    check ("white noise", noise, 0.0f);

    std::printf (failures == 0 ? "tuner: ok\n" : "tuner: %d failures\n", failures);
    return failures == 0 ? 0 : 1;
}
