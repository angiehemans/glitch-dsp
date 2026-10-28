#include "Tuner.h"

#include <algorithm>
#include <cmath>

namespace glitch
{

float detectPitch (const float* x, int n, double sampleRate)
{
    const auto tauMin = std::max (2, (int) (sampleRate / 1500.0));
    const auto tauMax = std::min (n / 2, (int) (sampleRate / 25.0));
    if (tauMax <= tauMin + 2)
        return 0.0f;

    double energy = 0;
    for (int i = 0; i < n; ++i)
        energy += (double) x[i] * x[i];
    if (energy / n < 1.0e-7) // quieter than about -70 dBFS RMS: nothing to tune
        return 0.0f;

    // Difference function, then its cumulative mean normalised form (YIN steps 2 and 3).
    const auto w = n - tauMax;
    std::vector<float> d ((size_t) tauMax + 2, 1.0f), raw ((size_t) tauMax + 2, 0.0f);
    double running = 0;
    for (int tau = 1; tau <= tauMax + 1 && tau + w <= n; ++tau)
    {
        double sum = 0;
        for (int j = 0; j < w; ++j)
        {
            const auto diff = (double) x[j] - x[j + tau];
            sum += diff * diff;
        }
        running += sum;
        raw[(size_t) tau] = (float) sum;
        d[(size_t) tau] = running > 0 ? (float) (sum * tau / running) : 1.0f;
    }

    // The first dip under the threshold, followed to its bottom (step 4).
    constexpr float threshold = 0.12f;
    int tau = -1;
    for (int t = tauMin; t < tauMax; ++t)
    {
        if (d[(size_t) t] < threshold)
        {
            while (t + 1 < tauMax && d[(size_t) t + 1] < d[(size_t) t])
                ++t;
            tau = t;
            break;
        }
    }
    if (tau < 0)
        return 0.0f; // no clear period

    // Parabolic interpolation around the dip, on the raw difference, which the normalisation would bend (step 5).
    const auto a = raw[(size_t) tau - 1], b = raw[(size_t) tau], c = raw[(size_t) tau + 1];
    const auto denom = a - 2 * b + c;
    const auto exact = tau + (std::abs (denom) > 1.0e-9f ? 0.5f * (a - c) / denom : 0.0f);
    return (float) (sampleRate / exact);
}

//==============================================================================
Tuner::Tuner() : juce::Thread ("Tuner") {}

Tuner::~Tuner()
{
    stop();
}

void Tuner::start (double sampleRate)
{
    if (running.load())
        return;
    rate = sampleRate;
    fifo.reset();
    std::fill (history.begin(), history.end(), 0.0f);
    running = true;
    startThread();
}

void Tuner::stop()
{
    running = false;
    stopThread (500);
    hz = 0.0f;
}

void Tuner::push (const float* samples, int numSamples)
{
    if (! running.load())
        return;
    int start1, size1, start2, size2;
    fifo.prepareToWrite (numSamples, start1, size1, start2, size2); // what doesn't fit is dropped
    std::copy (samples, samples + size1, fifoData.begin() + start1);
    std::copy (samples + size1, samples + size1 + size2, fifoData.begin() + start2);
    fifo.finishedWrite (size1 + size2);
}

void Tuner::run()
{
    while (! threadShouldExit())
    {
        wait (40);

        // Slide the window along by whatever arrived.
        const auto ready = std::min (fifo.getNumReady(), window);
        if (ready > 0)
        {
            std::move (history.begin() + ready, history.end(), history.begin());
            int start1, size1, start2, size2;
            fifo.prepareToRead (ready, start1, size1, start2, size2);
            const auto tail = history.end() - ready;
            std::copy (fifoData.begin() + start1, fifoData.begin() + start1 + size1, tail);
            std::copy (fifoData.begin() + start2, fifoData.begin() + start2 + size2, tail + size1);
            fifo.finishedRead (size1 + size2);
            fifo.finishedRead (std::max (0, fifo.getNumReady() - window)); // fell behind: keep only the newest
        }

        hz = detectPitch (history.data(), window, rate);
    }
}

} // namespace glitch
