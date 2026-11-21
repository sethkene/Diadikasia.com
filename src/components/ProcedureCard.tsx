import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ProcedureVideo } from '../types';
import { formatCount, formatDaysAgo } from '../utils/format';
import { ProcedureThumbnail } from './BrandLogo';

interface ProcedureCardProps {
  video: ProcedureVideo;
  extraViews: number;
  completedCount: number;
  onOpen: (id: number) => void;
  onOpenInstructor?: (instructorName: string) => void;
}

export const ProcedureCard: React.FC<ProcedureCardProps> = ({
  video,
  extraViews,
  completedCount,
  onOpen,
  onOpenInstructor,
}) => {
  const totalViews = video.views + extraViews;
  const instructorShort = video.instructor.split(',')[0];

  return (
    <div className="group w-full text-left bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 transition-colors">
      <button
        type="button"
        onClick={() => onOpen(video.id)}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
      >
        <ProcedureThumbnail
          hue={video.hue}
          category={video.category}
          duration={video.duration}
        />
      </button>
      <div className="p-4">
        <button
          type="button"
          onClick={() => onOpen(video.id)}
          className="block w-full text-left font-display font-bold text-[15px] text-slate-900 leading-snug group-hover:text-teal-700 transition-colors focus-visible:outline-none focus-visible:underline"
        >
          {video.title}
        </button>
        <div className="text-xs text-slate-500 mt-1 truncate">
          {onOpenInstructor ? (
            <button
              type="button"
              onClick={() => onOpenInstructor(video.instructor)}
              className="font-semibold text-teal-700 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {instructorShort}
            </button>
          ) : (
            <span>{instructorShort}</span>
          )}{' '}
          · {video.organization}
        </div>
        <button
          type="button"
          onClick={() => onOpen(video.id)}
          className="w-full text-left mt-3 pt-2.5 border-t border-slate-100 flex items-center flex-wrap gap-x-2 gap-y-1 text-xs text-slate-600 focus-visible:outline-none"
        >
          <span className="font-medium text-teal-700">{video.region}</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Reviewed
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-sky-700 font-medium">Practice</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="tabular-nums text-slate-500">
            {completedCount > 0
              ? `${completedCount}/${video.steps.length} steps`
              : `${video.steps.length} steps`}
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="tabular-nums text-slate-500">
            {formatCount(totalViews)} views
          </span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <span className="text-slate-500">{formatDaysAgo(video.daysAgo)}</span>
        </button>
      </div>
    </div>
  );
};
