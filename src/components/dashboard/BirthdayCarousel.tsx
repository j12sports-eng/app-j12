import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Cake, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import { Button } from "@/components/ui/button";
import { BirthdayCard } from "@/components/dashboard/BirthdayCard";
import { cn } from "@/lib/utils";
import type { BirthdayStudent } from "@/types/BirthdayTypes";

type BirthdayCarouselProps = {
  students: BirthdayStudent[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  autoplay?: boolean;
  ariaLabel: string;
};

function BirthdaySkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="min-h-[284px] animate-pulse rounded-2xl border border-white/10 bg-black/30 p-4"
        >
          <div className="flex gap-3">
            <div className="h-16 w-16 rounded-full bg-white/10" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-4/5 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-primary/20" />
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="h-10 rounded-xl bg-white/10" />
            <div className="h-10 rounded-xl bg-white/10" />
            <div className="h-10 rounded-xl bg-white/10" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <div className="h-10 rounded-lg bg-white/10" />
            <div className="h-10 rounded-lg bg-primary/20" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyBirthdays() {
  return (
    <div className="grid min-h-[220px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-center">
      <div>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
          <Cake className="h-7 w-7" />
        </div>
        <p className="mt-4 text-sm font-black text-white">Nenhum aniversariante encontrado.</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">
          Assim que houver alunos com aniversario neste periodo, eles aparecem aqui.
        </p>
      </div>
    </div>
  );
}

function ErrorBirthdays({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-red-400/20 bg-red-500/10 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-black/25 text-red-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="font-black text-white">Erro ao carregar aniversariantes</p>
            <p className="mt-1 text-sm leading-5 text-red-100/80">{error}</p>
          </div>
        </div>

        {onRetry ? (
          <Button
            type="button"
            onClick={onRetry}
            variant="outline"
            className="border-red-300/20 bg-black/20 text-red-50 hover:bg-red-500/15"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Tentar novamente
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function BirthdayCarouselComponent({
  students,
  loading = false,
  error = null,
  onRetry,
  autoplay = true,
  ariaLabel,
}: BirthdayCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [snapCount, setSnapCount] = useState(0);
  const [paused, setPaused] = useState(false);
  const hasMultipleSlides = students.length > 1;

  const carouselOptions = useMemo(
    () => ({
      align: "start" as const,
      loop: hasMultipleSlides,
      dragFree: false,
    }),
    [hasMultipleSlides],
  );

  const updateCarouselState = useCallback((carouselApi: CarouselApi) => {
    if (!carouselApi) return;

    setSelectedIndex(carouselApi.selectedScrollSnap());
    setSnapCount(carouselApi.scrollSnapList().length);
  }, []);

  useEffect(() => {
    if (!api) return;

    updateCarouselState(api);
    api.on("select", updateCarouselState);
    api.on("reInit", updateCarouselState);

    return () => {
      api.off("select", updateCarouselState);
      api.off("reInit", updateCarouselState);
    };
  }, [api, updateCarouselState]);

  useEffect(() => {
    if (!api || !autoplay || paused || !hasMultipleSlides) return;

    const timer = window.setInterval(() => {
      api.scrollNext();
    }, 5000);

    return () => window.clearInterval(timer);
  }, [api, autoplay, hasMultipleSlides, paused]);

  const handleMouseEnter = useCallback(() => setPaused(true), []);
  const handleMouseLeave = useCallback(() => setPaused(false), []);
  const handleFocus = useCallback(() => setPaused(true), []);
  const handleBlur = useCallback(() => setPaused(false), []);

  if (loading) {
    return <BirthdaySkeleton />;
  }

  if (error) {
    return <ErrorBirthdays error={error} onRetry={onRetry} />;
  }

  if (students.length === 0) {
    return <EmptyBirthdays />;
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
    >
      <Carousel opts={carouselOptions} setApi={setApi} className="px-1" aria-label={ariaLabel}>
        <CarouselContent className="-ml-3">
          {students.map((student) => (
            <CarouselItem key={student.id} className="basis-full pl-3 md:basis-1/2 xl:basis-1/4">
              <BirthdayCard student={student} />
            </CarouselItem>
          ))}
        </CarouselContent>

        {hasMultipleSlides ? (
          <>
            <CarouselPrevious
              aria-label="Aniversariante anterior"
              className="left-2 h-10 w-10 border-white/10 bg-black/75 text-white shadow-xl hover:border-primary/35 hover:bg-primary hover:text-black disabled:hidden"
            >
              <ChevronLeft className="h-5 w-5" />
            </CarouselPrevious>
            <CarouselNext
              aria-label="Proximo aniversariante"
              className="right-2 h-10 w-10 border-white/10 bg-black/75 text-white shadow-xl hover:border-primary/35 hover:bg-primary hover:text-black disabled:hidden"
            >
              <ChevronRight className="h-5 w-5" />
            </CarouselNext>
          </>
        ) : null}
      </Carousel>

      {snapCount > 1 ? (
        <div className="mt-4 flex justify-center gap-2" aria-label="Paginas do carrossel">
          {Array.from({ length: snapCount }, (_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => api?.scrollTo(index)}
              aria-label={`Ir para pagina ${index + 1}`}
              aria-current={selectedIndex === index ? "true" : undefined}
              className={cn(
                "h-2.5 rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                selectedIndex === index
                  ? "w-8 bg-primary shadow-[0_0_18px_rgba(255,69,0,0.45)]"
                  : "w-2.5 bg-white/20 hover:bg-white/35",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const BirthdayCarousel = memo(BirthdayCarouselComponent);
