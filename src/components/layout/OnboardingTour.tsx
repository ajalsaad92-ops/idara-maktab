import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";

const steps = [
  {
    target: "[data-tour='check-in']",
    title: "زر الحضور",
    description: "اضغط هذا الزر عند وصولك للمكتب لتسجيل الدخول",
    position: "bottom",
  },
  {
    target: "[data-tour='tasks']",
    title: "مهامك اليومية",
    description: "هنا يمكنك رؤية جميع المهام المسندة إليك",
    position: "top",
  },
  {
    target: "[data-tour='notifications']",
    title: "الإشعارات",
    description: "تابع إشعاراتك الجديدة هنا",
    position: "bottom",
  },
  {
    target: "[data-tour='language']",
    title: "تغيير اللغة",
    description: "استخدم هذا الزر للتبديل بين العربية والإنجليزية",
    position: "bottom",
  },
  {
    target: "[data-tour='profile']",
    title: "ملفك الشخصي",
    description: "تحقق من إعداداتك وملفك الشخصي",
    position: "bottom",
  },
];

export function OnboardingTour() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [showTour, setShowTour] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `onboarding_completed_${user.id}`;
    const isCompleted = localStorage.getItem(key);
    if (!isCompleted) {
      setShowTour(true);
    }
  }, [user]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = () => {
    if (user) {
      localStorage.setItem(`onboarding_completed_${user.id}`, "true");
    }
    setCompleted(true);
    setShowTour(false);
  };

  const handleSkip = () => {
    if (user) {
      localStorage.setItem(`onboarding_completed_${user.id}`, "true");
    }
    setShowTour(false);
  };

  if (!showTour || completed) return null;

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={handleSkip} />
      
      {/* Tooltip */}
      <AnimatePresence>
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
        >
          <Card className="w-80 p-4 shadow-xl border-2 border-accent">
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-bold text-lg text-primary">{step.title}</h3>
              <button onClick={handleSkip} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-4">{step.description}</p>
            <div className="flex justify-between items-center">
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full ${i === currentStep ? "bg-accent" : "bg-muted"}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  {t("skip") || "تخطي"}
                </Button>
                <Button size="sm" onClick={handleNext}>
                  {currentStep < steps.length - 1 ? (
                    <>
                      {t("next") || "التالي"} <ArrowRight className="h-4 w-4 me-1" />
                    </>
                  ) : (
                    t("finish") || "إنهاء"
                  )}
                </Button>
              </div>
            </div>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
