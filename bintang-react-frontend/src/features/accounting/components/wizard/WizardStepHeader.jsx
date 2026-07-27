export default function WizardStepHeader({ steps, currentStep, furthestStep, onSelectStep }) {
  return (
    <div className="flex text-xs font-semibold rounded-lg overflow-hidden border border-slate-200">
      {steps.map((step) => {
        const isActive = step.id === currentStep;
        const isReachable = step.id <= furthestStep;
        return (
          <button
            key={step.id}
            type="button"
            disabled={!isReachable}
            onClick={() => onSelectStep(step.id)}
            className={`flex-1 py-3 px-2 text-center transition-colors ${
              isActive
                ? 'bg-[#0088E8] text-white'
                : isReachable
                  ? 'bg-sky-50 text-[#0088E8] hover:bg-sky-100 cursor-pointer'
                  : 'bg-white text-slate-400 cursor-not-allowed'
            }`}
          >
            {step.label}
          </button>
        );
      })}
    </div>
  );
}
