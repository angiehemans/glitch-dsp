#include "NamModel.h"

#include "NAM/dsp.h"
#include "NAM/get_dsp.h"
#include "NAM/activations.h"

namespace glitch
{

namespace
{

    class Model final : public NamModel
    {
    public:
        explicit Model (std::unique_ptr<nam::DSP> dspIn) : dsp (std::move (dspIn)) {}

        void reset (double sampleRate, int maxBlockSize) override { dsp->Reset (sampleRate, maxBlockSize); }

        void process (const float* in, float* out, int numSamples) override
        {
            auto* input = const_cast<float*> (in); // NAM's API takes non-const pointers but doesn't write input
            dsp->process (&input, &out, numSamples);
        }

        double getExpectedSampleRate() const override { return dsp->GetExpectedSampleRate(); }

        std::optional<double> getLoudness() const override
        {
            return dsp->HasLoudness() ? std::optional<double> (dsp->GetLoudness()) : std::nullopt;
        }

    private:
        std::unique_ptr<nam::DSP> dsp;
    };
}

std::unique_ptr<NamModel> NamModel::load (const std::string& path, std::string& error)
{
    // The NAM plugin's default too: a fast tanh approximation, a big saving for WaveNet models.
    [[maybe_unused]] static const bool fastTanh = [] { nam::activations::Activation::enable_fast_tanh(); return true; }();

    try
    {
        auto dsp = nam::get_dsp (std::filesystem::path (path));
        if (dsp == nullptr)
        {
            error = "Not a NAM model";
            return nullptr;
        }
        if (dsp->NumInputChannels() != 1 || dsp->NumOutputChannels() != 1)
        {
            error = "Only mono NAM models are supported";
            return nullptr;
        }
        return std::make_unique<Model> (std::move (dsp));
    }
    catch (const std::exception& e)
    {
        error = e.what();
        return nullptr;
    }
}

} // namespace glitch
