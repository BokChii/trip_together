import React, { useEffect, useState } from 'react';
import {
  Plane,
  CalendarHeart,
  Check,
  Share2,
  Crown,
  User as UserIcon,
  Copy,
} from 'lucide-react';
import { Button } from './Button';
import { Modal, ModalFooter, ModalHeader } from './Modal';

const TOTAL_STEPS = 4;
const TITLE_ID = 'tutorial-title';

interface TutorialModalProps {
  open: boolean;
  onClose: (dontShowAgain: boolean) => void;
}

export const TutorialModal: React.FC<TutorialModalProps> = ({ open, onClose }) => {
  const [step, setStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(0);
      setDontShowAgain(false);
    }
  }, [open]);

  const handleClose = () => onClose(dontShowAgain);

  const StepDots = () => (
    <div className="flex justify-center gap-1.5 mb-4">
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full ${i === step ? 'bg-orange-500' : 'bg-orange-200'}`}
        />
      ))}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      titleId={TITLE_ID}
      size="lg"
      scrollable
      closeOnBackdrop
      closeOnEscape
    >
      {step === 0 && (
        <>
          <ModalHeader icon={Plane} title="언제갈래? 시작하기" titleId={TITLE_ID} />
          <div className="mb-6">
            <p className="text-sm sm:text-base text-gray-600 mb-4 leading-relaxed">
              <strong className="text-orange-600">언제갈래?</strong>는 친구들과 함께 여행 일정을
              조율하는 서비스입니다. 각자 가능한 날짜를 선택하면 모두가 가능한 날짜를 한눈에
              확인할 수 있어요!
            </p>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <p className="text-xs text-orange-800 leading-relaxed">
                캘린더에서 드래그로 여러 날짜를 한 번에 선택하고, &quot;가능해요&quot; 또는
                &quot;안돼요&quot;로 투표하세요. 모든 참여자가 가능한 날짜는 👑 표시로
                보여집니다!
              </p>
            </div>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <ModalHeader icon={CalendarHeart} title="날짜 선택하기" titleId={TITLE_ID} />
          <div className="mb-6 space-y-3">
            {[
              {
                icon: Check,
                title: '단일 선택',
                desc: '날짜를 클릭하거나 탭하면 선택/해제됩니다.',
              },
              {
                icon: Share2,
                title: '드래그 선택',
                desc: '날짜를 드래그하면 여러 날짜를 한 번에 선택할 수 있습니다. 모바일에서도 가능해요!',
              },
              {
                icon: Crown,
                title: '가장 많이 가능한 날짜',
                desc: '👑 표시가 있는 날짜는 가장 많은 참여자가 가능한 날짜입니다!',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                  <Icon className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">{title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <ModalHeader icon={UserIcon} title="참여자 필터 & 투표" titleId={TITLE_ID} />
          <div className="mb-6 space-y-3">
            {[
              {
                icon: Check,
                title: '투표 모드',
                desc: '"가능해요" / "안돼요" 모드를 선택한 뒤 날짜를 클릭하세요.',
              },
              {
                icon: UserIcon,
                title: '개별 참여자 보기',
                desc: '참여자 이름을 클릭하면 해당 참여자가 선택한 날짜만 볼 수 있습니다.',
              },
              {
                icon: Crown,
                title: '"가장 많이 가능" 필터',
                desc: '가장 많은 참여자가 가능한 날짜만 표시합니다.',
              },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3">
                <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                  <Icon className="w-4 h-4 text-orange-600" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">{title}</h4>
                  <p className="text-xs text-gray-600 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <ModalHeader icon={Share2} title="친구 초대하기" titleId={TITLE_ID} />
          <div className="mb-6 space-y-3">
            <div className="flex gap-3">
              <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                <Share2 className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-800 mb-1">초대하기 버튼</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  캘린더 화면 상단의 &quot;초대하기&quot; 버튼을 클릭하면 공유 링크가
                  생성됩니다.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="bg-orange-100 p-2 rounded-lg flex-shrink-0">
                <Copy className="w-4 h-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-800 mb-1">링크 복사</h4>
                <p className="text-xs text-gray-600 leading-relaxed">
                  생성된 링크를 복사하여 친구들에게 공유하세요. 친구들이 링크로 접속하면 같은
                  일정에 참여할 수 있습니다!
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          id="tutorial-dont-show-again"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="w-4 h-4 text-orange-500 rounded"
        />
        <label htmlFor="tutorial-dont-show-again" className="text-xs text-gray-600 cursor-pointer">
          다시 보지 않기
        </label>
      </div>

      <StepDots />

      <ModalFooter>
        {step > 0 ? (
          <Button variant="ghost" onClick={() => setStep(step - 1)} className="flex-1 min-h-[48px]">
            이전
          </Button>
        ) : (
          <Button variant="ghost" onClick={handleClose} className="flex-1 min-h-[48px]">
            건너뛰기
          </Button>
        )}
        {step < TOTAL_STEPS - 1 ? (
          <Button
            onClick={() => setStep(step + 1)}
            className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
          >
            다음
          </Button>
        ) : (
          <Button
            onClick={handleClose}
            className="flex-1 min-h-[48px] bg-orange-500 hover:bg-orange-600 text-white"
          >
            완료
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
};
