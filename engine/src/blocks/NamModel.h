#pragma once

#include <memory>
#include <optional>
#include <string>

namespace glitch
{

// A loaded NAM model behind a plain interface. NamModel.cpp is compiled into the `nam` library
// with NeuralAmpModelerCore, Eigen and its SIMD flags, so Eigen never appears in Glitch's own code
// (inline Eigen code built with different SIMD flags in two places is undefined behaviour).
class NamModel
{
public:
    /** Loads a .nam file; returns null and sets error if it can't. Allocates: never on the audio thread. */
    static std::unique_ptr<NamModel> load (const std::string& path, std::string& error);

    virtual ~NamModel() = default;

    /** Sizes buffers and prewarms. Allocates: call from prepareToPlay, not the audio thread. */
    virtual void reset (double sampleRate, int maxBlockSize) = 0;
    /** Mono in, mono out, numSamples <= the reset() block size. Real-time safe. */
    virtual void process (const float* in, float* out, int numSamples) = 0;

    /** The rate it was trained at (-1 when unknown); it runs at others, sounding slightly different. */
    virtual double getExpectedSampleRate() const = 0;
    /** The model's typical output loudness in dB, for normalising, when the file records it. */
    virtual std::optional<double> getLoudness() const = 0;
};

} // namespace glitch
