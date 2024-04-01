import { Fragment, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ScaleTime, scaleLinear, scaleTime } from 'd3';
import { gray, red, blue, yellow, pink, green, cyan, purple } from '@radix-ui/colors'; 
// @ts-ignore
import colorAlpha from "color-alpha";
import { addHours, addMinutes, parseISO, subDays, subHours, subMinutes, subSeconds } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useRouter } from 'next/router';

import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

import {
  AxisBottom,
  AxisLeft,
  ChartAutoWidthResizer,
  Line,
  LineWithCircle,
  Region,
  RulesBottom,
  Track,
  boundariesInRange,
  stairStepPath,
} from "@/charts";
import { Paginated, BattleWithParticipantsAndCheckinsAndEvents, BattleParticipant, TwilioParticipantData } from '@/types';
import { round } from '@/math';
import TwilioMetricsCache from '@/twilio-metrics-cache';

// The amount of time that a user must be offline before they automatically forfeit the battle
const BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS = 5.0;

const ParticipantRegion: React.FunctionComponent<{
  battle: BattleWithParticipantsAndCheckinsAndEvents | null,
  participant: Omit<BattleParticipant, 'battleId'>,
  participantsWithoutBattles: Array<BattleParticipant>,
  participantCheckinTimestamps: Map<BattleParticipant['id'], Array<Date>>,
  participantTwilioMetrics: Array<TwilioParticipantData>,
  twilioMetricsVisible: {
    publisherInfo: boolean,
    bitrate: boolean,
    video: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null,
    audio: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null,
  },
  xScale: ScaleTime<number, number>,
  heightInPx: number,
}> = ({
  battle,
  participant,
  participantsWithoutBattles,
  participantCheckinTimestamps,
  participantTwilioMetrics,
  twilioMetricsVisible,
  xScale,
  heightInPx,
}) => {
  const participantCreatedAtPositionInPx = xScale(parseISO(participant.createdAt));

  const participantsWithoutBattlesSorted = participantsWithoutBattles.sort((a, b) => a.createdAt > b.createdAt ? 1 : -1);
  const participantIndex = !battle ? participantsWithoutBattlesSorted.findIndex(p => p.id === participant.id) : -1;
  const nextParticipantCreatedBySameUser = participantIndex >= 0 ? participantsWithoutBattlesSorted
    .slice(participantIndex+1)
    .find(p => p.user.id === participant.user.id) : null;

  const imageSizeInPx = Math.min(heightInPx / 2, 32);
  const imageSizeHoveringInPx = Math.max(imageSizeInPx, 48);
  const [hovering, setHovering] = useState(false);

  const twilioMetrics = participantTwilioMetrics.find(p => p.twilioParticipant.participantIdentity === participant.id);
  const twilioBitrateYScale = useMemo(() => scaleLinear([0, 5000], [heightInPx, 4]), [heightInPx]);

  const twilioVideoBitrateYScale = useMemo(() => scaleLinear([0, 5000], [heightInPx, (heightInPx/2)+8]), [heightInPx]);
  const twilioVideoLatencyYScale = useMemo(() => scaleLinear([0, 1000], [heightInPx, (heightInPx/2)+8]), [heightInPx]);
  const twilioVideoPacketsLostYScale = useMemo(() => scaleLinear([0, 20], [heightInPx, (heightInPx/2)+8]), [heightInPx]);
  const twilioAudioBitrateYScale = useMemo(() => scaleLinear([0, 80], [heightInPx/2, 8]), [heightInPx]);
  const twilioAudioLatencyYScale = useMemo(() => scaleLinear([0, 500], [heightInPx/2, 8]), [heightInPx]);
  const twilioAudioPacketsLostYScale = useMemo(() => scaleLinear([0, 20], [heightInPx/2, 8]), [heightInPx]);

  return (
    <Fragment>
      {!battle ? (
        <text
          transform={`translate(${participantCreatedAtPositionInPx-6},8)`}
          textAnchor="end"
          fontSize={8}
          fill={gray.gray8}
          fontFamily="monospace"
        >{participant.id}</text>
      ) : null}

      <g
        onMouseOver={() => setHovering(true)}
        onMouseOut={() => setHovering(false)}
      >
        {participant.associatedWithBattleAt && participant.associatedWithBattleAt > participant.createdAt ? (
          <Region
            position={parseISO(participant.createdAt)}
            lengthInSeconds={(parseISO(participant.associatedWithBattleAt).getTime() - parseISO(participant.createdAt).getTime()) / 1000}
            heightInPx={heightInPx}
            backgroundColor={colorAlpha(green.green8, 0.2)}
            xScale={xScale}
            label="Matching"
            labelColor={green.green8}
          />
        ) : null}

        {participant.readyForBattleAt ? (
          <Line
            position={parseISO(participant.readyForBattleAt)}
            heightInPx={heightInPx}
            color={blue.blue8}
            xScale={xScale}
          />
        ) : null}

        {participant.associatedWithBattleAt ? (
          <LineWithCircle
            position={parseISO(participant.associatedWithBattleAt)}
            heightInPx={heightInPx}
            color={green.green8}
            label={participant.initialMatchFailed ? "B" : "L"}
            xScale={xScale}
          />
        ) : null}

        <Line
          position={parseISO(participant.createdAt)}
          heightInPx={heightInPx}
          color={gray.gray12}
          dashed
          xScale={xScale}
        />

        {(participantCheckinTimestamps.get(participant.id) || []).map(checkinTimestamp => (
          <Line
            key={checkinTimestamp.toISOString()}
            position={checkinTimestamp}
            heightInPx={heightInPx}
            color={red.red9}
            dashed
            xScale={xScale}
          />
        ))}

        <image
          href={participant.user.profileImageUrl || undefined}
          x={participantCreatedAtPositionInPx - imageSizeInPx - (hovering ? (imageSizeHoveringInPx-imageSizeInPx)/2 : 0)}
          y={((heightInPx - imageSizeInPx) / 2) - (hovering ? (imageSizeHoveringInPx-imageSizeInPx)/2 : 0)}
          height={hovering ? imageSizeHoveringInPx : imageSizeInPx}
          width={hovering ? imageSizeHoveringInPx : imageSizeInPx}
        />

        {!battle ? (
          <Region
            position={parseISO(participant.createdAt)}
            lengthInSeconds={((parseISO(participant.madeInactiveAt || nextParticipantCreatedBySameUser?.createdAt || participant.updatedAt).getTime()) - parseISO(participant.createdAt).getTime()) / 1000}
            heightInPx={heightInPx}
            backgroundColor={colorAlpha(green.green8, 0.2)}
            label="Matching"
            labelColor={green.green8}
            xScale={xScale}
          />
        ) : null}

        {participant.madeInactiveAt ? (
          <LineWithCircle
            position={parseISO(participant.madeInactiveAt)}
            heightInPx={heightInPx}
            label={participant.madeInactiveReason === "AUTO_FORFEIT_DUE_TO_INACTIVITY" ? "X" : ""}
            color={red.red8}
            xScale={xScale}
          />
        ) : null}
      </g>

      {twilioMetrics ? (
        <g>
          {twilioMetricsVisible.video || twilioMetricsVisible.audio || twilioMetricsVisible.publisherInfo || twilioMetricsVisible.bitrate ? (
            <Fragment>
              <Line
                position={parseISO(twilioMetrics.twilioParticipant.joinTime)}
                heightInPx={heightInPx}
                color={gray.gray8}
                xScale={xScale}
              />
              <Line
                position={parseISO(twilioMetrics.twilioParticipant.leaveTime)}
                heightInPx={heightInPx}
                color={gray.gray8}
                xScale={xScale}
              />
            </Fragment>
          ) : null}

          {["video" as const, "audio" as const].map(trackType => {
            if (!twilioMetricsVisible[trackType]) {
              return null;
            }
            if (twilioMetrics.trackMetrics.metrics[trackType].length === 0) {
              return null;
            }

            return (
              <g>
                <text
                  transform={`translate(${
                    xScale(parseISO(twilioMetrics.trackMetrics.metrics[trackType][0].startTime))+3
                  },${
                    trackType === "video" ? (heightInPx/2)+3 : 3
                  })`}
                  alignmentBaseline="text-before-edge"
                  fontSize={8}
                  opacity={0.5}
                >{trackType}: {twilioMetrics.trackMetrics.metrics[trackType][0].trackSid}</text>

                {twilioMetricsVisible[trackType]?.bitrate ? (
                  <g>
                    <g transform={`translate(${xScale(parseISO(twilioMetrics.trackMetrics.metrics[trackType][0].startTime))-4},0)`}>
                      <AxisLeft
                        type="GENERATED_TICKS"
                        pixelsPerTick={8}
                        yScale={trackType === "video" ? twilioVideoBitrateYScale : twilioAudioBitrateYScale}
                        axisColor={purple.purple8}
                        tickColor={purple.purple8}
                        labelColor={purple.purple8}
                        tickFormatter={n => `${n} kbps`}
                      />
                    </g>
                    <path 
                      d={stairStepPath(
                        xScale,
                        trackType === "video" ? twilioVideoBitrateYScale : twilioAudioBitrateYScale,
                        twilioMetrics.trackMetrics.metrics[trackType][0].metrics.map(m => [new Date(m.timeMs), m.bitrate]),
                      )}
                      stroke={purple.purple8}
                      fill="transparent"
                    />
                  </g>
                ) : null}

                {twilioMetricsVisible[trackType]?.latency ? (
                  <g>
                    <g transform={`translate(${xScale(parseISO(twilioMetrics.trackMetrics.metrics[trackType][0].startTime))-4},0)`}>
                      <AxisLeft
                        type="GENERATED_TICKS"
                        pixelsPerTick={8}
                        yScale={trackType === "video" ? twilioVideoLatencyYScale : twilioAudioLatencyYScale}
                        axisColor={pink.pink8}
                        tickColor={pink.pink8}
                        labelColor={pink.pink8}
                        tickFormatter={n => `${n} ms`}
                      />
                    </g>
                    <path 
                      d={stairStepPath(
                        xScale,
                        trackType === "video" ? twilioVideoLatencyYScale : twilioAudioLatencyYScale,
                        twilioMetrics.trackMetrics.metrics[trackType][0].metrics.map(m => [new Date(m.timeMs), m.latency]),
                      )}
                      stroke={pink.pink8}
                      fill="transparent"
                    />
                  </g>
                ) : null}

                {twilioMetricsVisible[trackType]?.packetsLost ? (
                  <g>
                    <g transform={`translate(${xScale(parseISO(twilioMetrics.trackMetrics.metrics[trackType][0].startTime))-4},0)`}>
                      <AxisLeft
                        type="GENERATED_TICKS"
                        pixelsPerTick={8}
                        yScale={trackType === "video" ? twilioVideoPacketsLostYScale : twilioAudioPacketsLostYScale}
                        axisColor={cyan.cyan8}
                        tickColor={cyan.cyan8}
                        labelColor={cyan.cyan8}
                        tickFormatter={n => `${n}%`}
                      />
                    </g>
                    <path 
                      d={stairStepPath(
                        xScale,
                        trackType === "video" ? twilioVideoPacketsLostYScale : twilioAudioPacketsLostYScale,
                        twilioMetrics.trackMetrics.metrics[trackType][0].metrics.map(m => [new Date(m.timeMs), m.packetsLost]),
                      )}
                      stroke={cyan.cyan8}
                      fill="transparent"
                    />
                  </g>
                ) : null}
              </g>
            );
          })}

          {twilioMetricsVisible.bitrate && twilioMetrics.connectionMetrics.metrics.length > 0 ? (
            <g>
              <g transform={`translate(${xScale(new Date(twilioMetrics.connectionMetrics.metrics[0].timeMs))-4},0)`}>
                <AxisLeft
                  type="GENERATED_TICKS"
                  pixelsPerTick={8}
                  yScale={twilioBitrateYScale}
                  axisColor={green.green8}
                  tickColor={green.green8}
                  labelColor={green.green8}
                  tickFormatter={n => `${n} kbps`}
                />
              </g>
              <path 
                d={stairStepPath(
                  xScale,
                  twilioBitrateYScale,
                  twilioMetrics.connectionMetrics.metrics.map(m => [new Date(m.timeMs), m.bitrate]),
                )}
                stroke={green.green8}
                fill="transparent"
              />
            </g>
          ) : null}

          {twilioMetricsVisible.publisherInfo ? (
            <text
              transform={`translate(${xScale(parseISO(twilioMetrics.twilioParticipant.joinTime))},0)`}
              alignmentBaseline="text-before-edge"
              fontSize={4}
            >
              {JSON.stringify(twilioMetrics.twilioParticipant.publisherInfo)}
            </text>
          ) : null}
        </g>
      ) : null}
    </Fragment>
  );
};

const BattleRegion: React.FunctionComponent<{
  battle: BattleWithParticipantsAndCheckinsAndEvents,
  xScale: ScaleTime<number, number>,
  heightInPx: number,
  participantCheckinTimestamps: Map<BattleParticipant['id'], Array<Date>>,
  participantTwilioMetrics: Array<TwilioParticipantData>,
  twilioMetricsVisible: {
    publisherInfo: boolean,
    bitrate: boolean,
    video: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null,
    audio: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null,
  },
  onClick: (e: any) => void,
}> = ({
  battle,
  xScale,
  heightInPx,
  participantCheckinTimestamps,
  participantTwilioMetrics,
  twilioMetricsVisible,
  onClick,
}) => {
  const battleCreatedAtPositionPx = xScale(parseISO(battle.createdAt));

  const participantTrackHeightInPx = heightInPx / (battle ? battle.participants.length : 2);

  const latestParticipantUpdatedAt = battle.participants.map(p => p.updatedAt).sort().at(-1) || battle.updatedAt;

  return (
    <g
      key={battle.id}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
    >
      <text
        transform={`translate(${battleCreatedAtPositionPx-6},8)`}
        textAnchor="end"
        fontSize={8}
        fill={gray.gray8}
        fontFamily="monospace"
        textDecoration="underline"
      >{battle.id}</text>

      <Region
        position={parseISO(battle.createdAt)}
        lengthInSeconds={(parseISO((battle.startedAt || battle.madeInactiveAt || latestParticipantUpdatedAt) as string).getTime() - parseISO(battle.createdAt).getTime()) / 1000}
        heightInPx={heightInPx}
        backgroundColor={colorAlpha(blue.blue8, 0.2)}
        xScale={xScale}
        label="Opponent Preview"
        labelColor={blue.blue8}
      />

      {battle.participants.sort((a, b) => (a.order || 0) - (b.order || 0)).map((participant, participantIndex) => {
        return (
          <Track
            yOffset={participantIndex * participantTrackHeightInPx}
            heightInPx={participantTrackHeightInPx}
            xScale={xScale}
          >
            <ParticipantRegion
              key={participant.id}
              battle={battle}
              participant={participant}
              participantsWithoutBattles={[]}
              participantCheckinTimestamps={participantCheckinTimestamps}
              participantTwilioMetrics={participantTwilioMetrics}
              twilioMetricsVisible={twilioMetricsVisible}
              xScale={xScale}
              heightInPx={participantTrackHeightInPx}
            />
          </Track>
        );
      })}

      {/* show shaded region for battle length */}
      {battle.startedAt ? (
        <Region
          position={parseISO(battle.startedAt)}
          lengthInSeconds={(parseISO(battle.completedAt || latestParticipantUpdatedAt).getTime() - parseISO(battle.startedAt).getTime()) / 1000}
          heightInPx={heightInPx}
          backgroundColor={colorAlpha(red.red8, 0.2)}
          xScale={xScale}
          label="Battle"
          labelColor={red.red8}
        />
      ) : null}
      {battle.startedAt ? (
        <Line
          position={parseISO(battle.startedAt)}
          heightInPx={heightInPx}
          color={red.red8}
          dashed
          xScale={xScale}
        />
      ) : null}
      {battle.completedAt ? (
        <Line
          position={parseISO(battle.completedAt)}
          heightInPx={heightInPx}
          color={red.red8}
          dashed
          xScale={xScale}
        />
      ) : null}

      {/* If a forfeit happens, show that it happened */}
      {battle.madeInactiveAt ? (
        <Fragment>
          <Line
            position={parseISO(battle.madeInactiveAt)}
            heightInPx={heightInPx}
            color={yellow.yellow8}
            dashed
            xScale={xScale}
          />
          {battle.madeInactiveReason === "AUTO_FORFEIT_DUE_TO_INACTIVITY" ? (
            <Region
              position={subSeconds(parseISO(battle.madeInactiveAt), BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS)}
              lengthInSeconds={BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS}
              heightInPx={heightInPx}
              backgroundColor={yellow.yellow8}
              hatched
              xScale={xScale}
              label="Forfeit Inactivity"
              labelColor="black"
            />
          ) : null}
        </Fragment>
      ) : null}
    </g>
  );
};

const Chart: React.FunctionComponent<{
  startDate: Date,
  endDate: Date,

  heightInPx?: number,

  battles: Array<BattleWithParticipantsAndCheckinsAndEvents>,
  participantsWithoutBattles: Array<BattleParticipant>,
  participantCheckinTimestamps: Map<BattleParticipant['id'], Array<Date>>,
  participantTwilioMetrics: Array<TwilioParticipantData>,
  twilioMetricsVisible: {
    publisherInfo: boolean,
    bitrate: boolean,
    video: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null,
    audio: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null,
  },

  onClickBattle: (battleId: BattleWithParticipantsAndCheckinsAndEvents['id'], e: any) => void,
  onSelectTimespan: (start: Date, end: Date) => void,
}> = ({
  startDate,
  endDate,
  heightInPx = 500,
  battles,
  participantsWithoutBattles,
  participantCheckinTimestamps,
  participantTwilioMetrics,
  twilioMetricsVisible,
  onClickBattle,
  onSelectTimespan,
}) => {
  const binPackedTracks = useMemo(() => {
    const binPackedTracks: Array<Array<
      { start: Date, end: Date, type: "battle", object: BattleWithParticipantsAndCheckinsAndEvents } |
      { start: Date, end: Date, type: "participant", object: BattleParticipant }
    >> = [];

    for (const {type, battleOrParticipant} of [
      ...participantsWithoutBattles.map(p => ({type: "participant" as const, battleOrParticipant: p})),
      ...battles.map(b => ({type: "battle" as const, battleOrParticipant: b})),
    ]) {
      let createdAt: Date, completedAt: Date;
      switch (type) {
        case "battle":
          // console.log('battle:', battle.id);
          createdAt = parseISO(battleOrParticipant.createdAt);
          completedAt = parseISO(battleOrParticipant.completedAt || battleOrParticipant.updatedAt);
          // console.log('battleCreatedAt:', battleCreatedAt.toISOString());
          // console.log('battleCompletedAt:', battleCompletedAt.toISOString());
          break;
        case "participant":
          createdAt = parseISO(battleOrParticipant.createdAt);

          const participantIndex = participantsWithoutBattles.findIndex(p => p.id === battleOrParticipant.id);
          const nextParticipantCreatedBySameUser = participantsWithoutBattles
            .slice(participantIndex+1)
            .find(p => p.user.id === battleOrParticipant.user.id);

          if (nextParticipantCreatedBySameUser) {
            completedAt = parseISO(nextParticipantCreatedBySameUser.createdAt);
          } else {
            completedAt = parseISO(battleOrParticipant.madeInactiveAt || battleOrParticipant.updatedAt);
          }
          break;
      }

      // Attempt to fit this battle into the track somewhere
      let added = false;
      for (let trackIndex = 0; trackIndex < binPackedTracks.length; trackIndex += 1) {
        const track = binPackedTracks[trackIndex];
        // console.log('--- track:', trackIndex);

        let isBeforeOrAfterAll = true;
        for (const { start, end } of track) {
          const startWithMargin = subMinutes(start, 5);
          const endWithMargin = addMinutes(end, 5);
          // console.log('start:', start.toISOString(), startWithMargin.toISOString());
          // console.log('end:', end.toISOString(), endWithMargin.toISOString());
          const isBeforeOrAfter =
            (createdAt < startWithMargin && completedAt < startWithMargin) ||
            (createdAt > endWithMargin && completedAt > endWithMargin);
          if (!isBeforeOrAfter) {
            // console.log('Not before or after!');
            isBeforeOrAfterAll = false;
            break;
          }
        }

        if (isBeforeOrAfterAll) {
          // console.log('>> add to track', trackIndex);
          binPackedTracks[trackIndex].push(type === "battle" ? {
            start: createdAt,
            end: completedAt,
            type: "battle",
            object: battleOrParticipant,
          } : { start: createdAt, end: completedAt, type: "participant", object: battleOrParticipant });
          added = true;
          break;
        }
      }

      // If no track was found that this fits into, then add a new track
      if (!added) {
        // console.log('>> add new', type);
        binPackedTracks.push([]);
        binPackedTracks.at(-1)!.push(type === "battle" ? {
          start: createdAt,
          end: completedAt,
          type: "battle",
          object: battleOrParticipant,
        } : { start: createdAt, end: completedAt, type: "participant", object: battleOrParticipant });
      }
    }

    return binPackedTracks;
  }, [battles, participantsWithoutBattles]);

  const ticks = useMemo(() => {
    return boundariesInRange(startDate, endDate);
  }, [startDate, endDate]);

  const margin = useMemo(
    () => ({ top: 8, right: 8, bottom: 24, left: 8 }),
    []
  );
  const [widthInPx, setWidthInPx] = useState(500);

  const [innerWidthInPx, innerHeightInPx] = useMemo(() => {
    return [
      widthInPx - margin.left - margin.right,
      heightInPx - margin.top - margin.bottom,
    ];
  }, [margin, widthInPx, heightInPx]);

  const trackHeightInPx = Math.min(innerHeightInPx / binPackedTracks.length, 256);

  const xScale = useMemo(() => {
    return scaleTime([startDate, endDate], [0, innerWidthInPx]);
  }, [startDate, endDate, innerWidthInPx]);

  const [selection, setSelection] = useState<[Date, Date] | null>(null);

  return (
    <ChartAutoWidthResizer
      height={heightInPx}
      onChangeWidth={(newWidthInPx) => setWidthInPx(newWidthInPx)}
    >
      <svg
        width={widthInPx}
        height={heightInPx}
        viewBox={`0 0 ${widthInPx} ${heightInPx}`}
      >
        {/* Add global click event handler for drag to select behavior */}
        <rect
          x={0}
          y={0}
          width={widthInPx}
          height={heightInPx}
          fill="transparent"
          onMouseDown={e => {
            const rect = e.currentTarget.getBoundingClientRect();

            let positionInPx = (e.clientX - rect.x) - margin.left;
            let position = xScale.invert(positionInPx);
            const initialPositionInPx = positionInPx;
            const initialPosition = position;
            setSelection([initialPosition, position]);

            document.body.style.userSelect = 'none';

            const onMouseMove = (e: MouseEvent) => {
              if (!e.buttons) {
                return;
              }

              positionInPx += e.movementX;
              position = xScale.invert(positionInPx);
              setSelection([initialPosition, position]);
            };
            window.addEventListener('mousemove', onMouseMove);

            const onMouseUp = () => {
              cleanup();

              if (Math.abs(initialPositionInPx - positionInPx) > 16) {
                if (initialPosition < position) {
                  onSelectTimespan(initialPosition, position);
                } else {
                  onSelectTimespan(position, initialPosition);
                }
              }
              setSelection(null);
            };
            window.addEventListener('mouseup', onMouseUp);

            const onKeyDown = (e: KeyboardEvent) => {
              if (e.key === 'Escape') {
                cleanup();
                setSelection(null);
              }
            };
            window.addEventListener('keydown', onKeyDown);

            const cleanup = () => {
              document.body.style.userSelect = 'auto';
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
              window.removeEventListener('keydown', onKeyDown);
            };
          }}
        />

        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <RulesBottom
            type="LITERAL_RULES"
            xScale={xScale}
            ruleLengthInPx={innerHeightInPx}
            rules={ticks}
            color={gray.gray5}
          />
          <g transform={`translate(0,${innerHeightInPx})`}>
            <AxisBottom
              type="LITERAL_TICKS"
              xScale={xScale}
              ticks={ticks}
              axisColor={gray.gray5}
              tickColor={gray.gray5}
              labelColor={gray.gray12}
              tickFormatter={(d) =>
                formatInTimeZone(new Date(d), "UTC", "MM/dd hh:mm:ss")
              }
            />
          </g>

          {binPackedTracks.map((track, trackIndex) => {
            return (
              <Track
                yOffset={trackIndex * trackHeightInPx}
                heightInPx={trackHeightInPx-4}
                xScale={xScale}
              >
                {track.map(entry => {
                  switch (entry.type) {
                    case "battle":
                      return (
                        <BattleRegion
                          battle={entry.object}
                          xScale={xScale}
                          heightInPx={trackHeightInPx-4}
                          participantCheckinTimestamps={participantCheckinTimestamps}
                          participantTwilioMetrics={participantTwilioMetrics}
                          twilioMetricsVisible={twilioMetricsVisible}
                          onClick={(e) => onClickBattle(entry.object.id, e)}
                        />
                      );
                    case "participant":
                      return (
                        <ParticipantRegion
                          key={entry.object.id}
                          battle={null}
                          participant={entry.object}
                          participantsWithoutBattles={participantsWithoutBattles}
                          participantCheckinTimestamps={participantCheckinTimestamps}
                          participantTwilioMetrics={participantTwilioMetrics}
                          twilioMetricsVisible={twilioMetricsVisible}
                          xScale={xScale}
                          heightInPx={(trackHeightInPx-4) / 2}
                        />
                      );
                  }
                })}
              </Track>
            );
          })}

          {selection ? (
            <g>
              {selection[1] > selection[0] ? (
                <rect
                  x={xScale(selection[0])}
                  y={0}
                  width={xScale(selection[1]) - xScale(selection[0])}
                  height={innerHeightInPx}
                  fill={blue.blue8}
                  fillOpacity={0.2}
                  stroke={blue.blue8}
                  strokeDasharray="4 4"
                />
              ) : (
                <rect
                  x={xScale(selection[1])}
                  y={0}
                  width={xScale(selection[0]) - xScale(selection[1])}
                  height={innerHeightInPx}
                  fill={blue.blue8}
                  fillOpacity={0.2}
                  stroke={blue.blue8}
                  strokeDasharray="4 4"
                />
              )}
            </g>
          ) : null}
        </g>
      </svg>
    </ChartAutoWidthResizer>
  );
};

const DatePicker: React.FunctionComponent<{ value: Date | null, onChange: (date: Date) => void, disabled?: boolean }> = ({ value, onChange, disabled }) => {
  return (
    <ReactDatePicker
      selected={value}
      showTimeSelect
      onChange={(newDate: Date) => onChange(newDate)}
      disabled={disabled}
    />
  );
};

const NumberInput: React.FunctionComponent<{ id?: string, value: number, onChange: (n: number) => void, placeholder?: string }> = ({ id, value, onChange, placeholder }) => {
  const [workingNumber, setWorkingNumber] = useState("");
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setWorkingNumber(`${value}`);
    setInvalid(false);
  }, [value]);

  return (
    <input
      id={id}
      placeholder={placeholder}
      type="number"
      value={workingNumber}
      style={{ border: invalid ? `1px solid ${red.red8}` : undefined }}
      onChange={e => setWorkingNumber(e.currentTarget.value)}
      onBlur={() => {
        const parsed = parseFloat(workingNumber);
        if (isNaN(parsed)) {
          setInvalid(true);
          return;
        }

        setInvalid(false);
        onChange(parsed);
      }}
    />
  );
}

function useQueryParams() {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [userIdList, setUserIdList] = useState<Array<BattleParticipant['id']>>([]);

  const router = useRouter();

  const firstRunRef = useRef(true);
  const searchParamsRef = useRef(new URL(`http://example.com${router.asPath}`).searchParams);

  const run = useCallback(() => {
    let searchParamsRefChanged = false;

    // Redirect to the detail page if an old link was clicked
    const battleIdQueryParam = searchParamsRef.current.get("battleid");
    if (battleIdQueryParam) {
      router.replace(`/new/battles/${battleIdQueryParam}?baseurl=${searchParamsRef.current.get("baseurl") || "https://api.rapbattleapp.com"}`)
      return;
    }

    const baseUrlRaw = searchParamsRef.current.get("baseurl");
    if (firstRunRef.current) {
      const newBaseUrl = baseUrlRaw || "https://api.rapbattleapp.com";
      setBaseUrl(newBaseUrl);

      searchParamsRef.current.set("baseurl", newBaseUrl);
      searchParamsRefChanged = true;
    } else if (baseUrl && baseUrl !== baseUrlRaw) {
      searchParamsRef.current.set("baseurl", baseUrl);
      searchParamsRefChanged = true;
    }

    const endDateRaw = searchParamsRef.current.get("enddate");
    const defaultEndDate = new Date();
    const newEndDate = endDateRaw ? parseISO(endDateRaw) : defaultEndDate;
    if (firstRunRef.current) {
      setEndDate(newEndDate);

      searchParamsRef.current.set("enddate", newEndDate.toISOString());
      searchParamsRefChanged = true;
    } else if (endDate && endDateRaw !== endDate.toISOString()) {
      searchParamsRef.current.set("enddate", endDate.toISOString());
      searchParamsRefChanged = true;
    }

    const startDateRaw = searchParamsRef.current.get("startdate");
    const defaultStartDate = subDays(defaultEndDate, 7);
    const newStartDate = startDateRaw ? parseISO(startDateRaw) : defaultStartDate;
    if (firstRunRef.current) {
      setStartDate(newStartDate);

      searchParamsRef.current.set("startdate", newStartDate.toISOString());
      searchParamsRefChanged = true;
    } else if (startDate && startDateRaw !== startDate.toISOString()) {
      searchParamsRef.current.set("startdate", startDate.toISOString());
      searchParamsRefChanged = true;
    }

    const userIdsListRaw = searchParamsRef.current.get("userids");
    const newUserIdsList = userIdsListRaw ? userIdsListRaw.split(",") : [];
    if (firstRunRef.current) {
      setUserIdList(newUserIdsList);

      if (newUserIdsList.length > 0) {
        searchParamsRef.current.set("userids", newUserIdsList.join(","));
      } else {
        searchParamsRef.current.delete("userids");
      }
      searchParamsRefChanged = true;
    } else if (userIdList && userIdsListRaw !== userIdList.join(",")) {
      if (userIdList.length > 0) {
        searchParamsRef.current.set("userids", userIdList.join(","));
      } else {
        searchParamsRef.current.delete("userids");
      }
      searchParamsRefChanged = true;
    }

    if (searchParamsRefChanged) {
      const path = `${router.pathname}?${searchParamsRef.current.toString()}`;
      if (firstRunRef.current) {
        router.replace(path);
      } else {
        router.push(path);
      }
    }

    firstRunRef.current = false;
  }, [baseUrl, startDate, endDate, userIdList]);

  useEffect(() => {
    run();
  }, [run]);

  useEffect(() => {
    router.beforePopState((e) => {
      searchParamsRef.current = new URL(`http://example.com${e.as}`).searchParams;
      firstRunRef.current = true;
      run();

      return true;
    });

    return () => {
      router.beforePopState(() => true);
    };
  }, [run]);

  return {
    baseUrl,
    setBaseUrl,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    userIdList,
    setUserIdList,
  };
}

export default function Index() {
  const router = useRouter();
  const {
    baseUrl,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    userIdList,
    setUserIdList,
  } = useQueryParams();

  const underFiveHoursSelected = useMemo(() => endDate && startDate && ((endDate.getTime() - startDate.getTime()) < 5 * 60 * 60 * 1000), [startDate, endDate]);

  const [showSettings, setShowSettings] = useState(false);

  const [checkinsVisible, setCheckinsVisible] = useState(false);
  const [twilioMetricsVisible, setTwilioMetricsVisible] = useState<{
    publisherInfo: boolean,
    bitrate: boolean,
    video: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null
    audio: { packetsLost: boolean, bitrate: boolean, latency: boolean } | null
  }>({ publisherInfo: false, bitrate: false, video: null, audio: null});
  const [battlesVisible, setBattlesVisible] = useState(true);
  const [unassociatedParticipantsVisible, setUnassociatedParticipantsVisible] = useState(true);
  const [heightInPx, setHeightInPx] = useState(600);
  const [selectedLiveTimeRange, setSelectedLiveTimeRange] = useState<"7d" | "2h" | "10m" | null>(null);

  const [workingUserIdList, setWorkingUserIdList] = useState("");
  useEffect(() => {
    setWorkingUserIdList(userIdList.join(","));
  }, [userIdList]);

  const [data, setData] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | {
      status: "COMPLETE",
      battles: Array<BattleWithParticipantsAndCheckinsAndEvents>,
      participants: Array<BattleParticipant>,
      participantCheckins: Map<string, Array<Date>>,
      participantTwilioMetrics: Array<TwilioParticipantData>,
    }
    | { status: "ERROR", error: any }
  >({ status: "IDLE" });

  // When a live time range is active, update the time span often
  useEffect(() => {
    if (!selectedLiveTimeRange) {
      return;
    }

    const run = () => {
      const now = new Date();
      switch (selectedLiveTimeRange) {
        case "7d":
          setStartDate(subDays(now, 7));
          setEndDate(now);
          break;
        case "2h":
          setStartDate(subHours(now, 2));
          setEndDate(now);
          break;
        case "10m":
          setStartDate(subMinutes(now, 10));
          setEndDate(now);
          break;
      }
    };
    run();

    const intervalId = setInterval(run, 2500);
    return () => clearInterval(intervalId);
  }, [selectedLiveTimeRange]);

  // When the time span, base url, or any filters change, refetch data.
  // Also just generally refetch data every 5 seconds to make sure things are somewhat up to date.
  const shouldFetchTwilioData = twilioMetricsVisible.bitrate || twilioMetricsVisible.publisherInfo || twilioMetricsVisible.audio !== null || twilioMetricsVisible.video !== null;
  useEffect(() => {
    if (!baseUrl) {
      return;
    }
    if (!startDate) {
      return;
    }
    if (!endDate) {
      return;
    }

    let cancelled = false;

    const rawBattleFilters = encodeURIComponent(JSON.stringify({
      createdAt: {
        gt: startDate.toISOString(),
        lte: endDate.toISOString(),
      },
      participants: userIdList.length > 0 ? {
        some: {
          user: {
            id: { in: userIdList },
          },
        },
      } : undefined,
    }));

    const rawParticipantFilters = encodeURIComponent(JSON.stringify({
      createdAt: {
        gt: startDate.toISOString(),
        lte: endDate.toISOString(),
      },
      user: userIdList.length > 0 ? {
        id: { in: userIdList },
      } : undefined,
    }));

    function recursivelyFetchAllBattles(page=1): Promise<Array<BattleWithParticipantsAndCheckinsAndEvents>> {
      return fetch(`${baseUrl}/v1/battles?filters=${rawBattleFilters}&page=${page}`).then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`Error fetching battles page ${page}: ${response.status} ${text}`);
          });
        }
        return response.json();
      }).then((body: Paginated<BattleWithParticipantsAndCheckinsAndEvents>) => {
        const results = body.results;

        if (body.next) {
          return recursivelyFetchAllBattles(page+1).then(rest => [...results, ...rest]);
        } else {
          return results;
        }
      });
    }

    function recursivelyFetchAllParticipantsNotAssociatedWithABattle(page=1): Promise<Array<BattleParticipant>> {
      return fetch(`${baseUrl}/v1/participants?filters=${rawParticipantFilters}&page=${page}`).then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`Error fetching participants page ${page}: ${response.status} ${text}`);
          });
        }
        return response.json();
      }).then((body: Paginated<BattleParticipant>) => {
        const results = body.results.filter(participant => participant.battleId === null);

        if (body.next) {
          return recursivelyFetchAllParticipantsNotAssociatedWithABattle(page+1).then(rest => [...results, ...rest]);
        } else {
          return results;
        }
      });
    }

    function fetchParticipantCheckinTimes(participantsIds: Array<BattleParticipant['id']>, countPerBatch = 32) {
      const batchCount = Math.ceil(participantsIds.length / countPerBatch);
      return Promise.all(new Array(batchCount).fill(0).map((_, index) => {
        const ids = participantsIds.slice(countPerBatch*index, countPerBatch*(index+1));

        return fetch(`${baseUrl}/v1/participants/checkin-times?ids=${ids.join(',')}`).then(response => {
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`Error fetching participant checkins batch ${index}: ${response.status} ${text}`);
            });
          }

          return response.json() as Promise<{ results: { [id: string]: Array<string> }}>;
        });
      })).then((checkinsResponses) => {
        return new Map(
          checkinsResponses.flatMap(response => Object.entries(response.results)).map(
            ([id, checkins]) => [id, checkins.map(c => parseISO(c))]
          ),
        );
      });
    }

    function fetchParticipantTwilioMetrics(battle: BattleWithParticipantsAndCheckinsAndEvents) {
      // Use the cache, if it is populated for all participants
      const cached = TwilioMetricsCache.get(battle.id);
      if (cached) {
        return cached;
      }

      return fetch(`http://localhost:3001/console/video/api/logs/rooms/${battle.twilioRoomSid}/participants`).then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`Error fetching twilio participants for battle with room ${battle.twilioRoomSid}: ${response.status} ${text}`);
          });
        }

        return response.json() as Promise<{
          sl_translate: "sl_none",
          participants: Array<TwilioParticipantData["twilioParticipant"]>,
          meta: {
            pageSize: number,
            directToken: boolean,
            totalSize: number,
          },
        }>;
      }).then(twilioParticipantData => {
        return Promise.all(twilioParticipantData.participants.map(twilioParticipant => {
          return Promise.all([
            fetch(`http://localhost:3001/console/video/api/logs/rooms/${battle.twilioRoomSid}/participants/${twilioParticipant.participantSid}/tracks/metrics`).then(response => {
              if (!response.ok) {
                return response.text().then(text => {
                  throw new Error(`Error fetching twilio participant ${twilioParticipant.participantIdentity} track metrics for battle with room ${battle.twilioRoomSid}: ${response.status} ${text}`);
                });
              }

              return response.json() as Promise<TwilioParticipantData["trackMetrics"]>;
            }),
            fetch(`http://localhost:3001/console/video/api/logs/rooms/${battle.twilioRoomSid}/participants/${twilioParticipant.participantSid}/connection/metrics`).then(response => {
              if (!response.ok) {
                return response.text().then(text => {
                  throw new Error(`Error fetching twilio participant ${twilioParticipant.participantIdentity} connection metrics for battle with room ${battle.twilioRoomSid}: ${response.status} ${text}`);
                });
              }

              return response.json() as Promise<TwilioParticipantData["connectionMetrics"]>;
            }),
          ]).then(([trackMetrics, connectionMetrics]) => {
            const result = { twilioParticipant, trackMetrics, connectionMetrics };
            return result;
          });
        }));
      }).then(finalData => {
        // Store the data in the cache so it won't be continuously refetched
        TwilioMetricsCache.set(battle.id, finalData);
        return finalData;
      });
    }

    if (!selectedLiveTimeRange) {
      setData({ status: "LOADING" });
    }
    function fetchData() {
      Promise.all([
        recursivelyFetchAllBattles(),
        recursivelyFetchAllParticipantsNotAssociatedWithABattle(),
      ]).then(([battles, participantsNotAssociatedWithABattle]) => {
        const allParticipantIds = [
          ...battles.flatMap(b => b.participants),
          ...participantsNotAssociatedWithABattle,
        ].map(p => p.id);

        return Promise.all([
          battles,
          participantsNotAssociatedWithABattle,
          fetchParticipantCheckinTimes(allParticipantIds),

          // If under a 5 hour time span is shown, fetch twilio data for battles
          underFiveHoursSelected && shouldFetchTwilioData ? Promise.all(battles.map(
            battle => fetchParticipantTwilioMetrics(battle),
          )).then(twilioData => twilioData.flat()).catch(() => []) : Promise.resolve([]),
        ]);
      }).then(([battles, participants, participantCheckins, participantTwilioMetrics]) => {
        if (cancelled) {
          return;
        }
        setData({
          status: "COMPLETE",
          battles,
          participants,
          participantCheckins,
          participantTwilioMetrics,
        });
      }).catch(error => {
        console.error('Error loading data!', error);
        setData({ status: "ERROR", error })
      });
    }
    fetchData();

    const intervalId = setInterval(fetchData, 5000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
      if (!selectedLiveTimeRange) {
        setData({ status: "IDLE" });
      }
    };
  }, [baseUrl, selectedLiveTimeRange, underFiveHoursSelected, shouldFetchTwilioData, startDate, endDate, userIdList]);

  const topBar = (
    <div style={{
      width: '100%',
      height: 48,
      paddingLeft: 8,
      paddingRight: 8,
      borderBottom: `1px solid ${gray.gray12}`,
      flexGrow: 0,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <h3>Barz Battle Visualizer</h3>
        {data.status === "COMPLETE" ? (
          <span style={{ fontSize: 10}}>{data.battles.length} battles, {data.participants.length} unassociated participants</span >
        ) : (
          <span style={{ fontSize: 10}}>&mdash;</span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            value={workingUserIdList}
            onChange={e => setWorkingUserIdList(e.currentTarget.value)}
            onBlur={() => setUserIdList(workingUserIdList.length > 0 ? workingUserIdList.split(',') : [])}
            placeholder="Comma seperated"
          />
          <span style={{ fontSize: 12 }}>User IDs</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {selectedLiveTimeRange ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" disabled value={selectedLiveTimeRange} />
              &rarr;
              <input type="text" disabled value="now" />
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <DatePicker value={startDate} onChange={setStartDate} />
              &rarr;
              <DatePicker value={endDate} onChange={setEndDate} />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 8 }}>
              Tip: Drag chart to pick a more precise range <div style={{
                border: `1px dashed ${blue.blue8}`,
                backgroundColor: colorAlpha(blue.blue8, 0.2),
                width: 32,
                height: 12,
              }} />
            </div>

            <div style={{ display: 'flex', gap: 2, alignItems: 'center', fontSize: 8 }}>
              {["7d" as const, "2h" as const, "10m" as const].map(n => (
                <button
                  style={{
                    fontSize: 10,
                    border: `1px solid ${selectedLiveTimeRange === n ? blue.blue8 : gray.gray10}`,
                    paddingLeft: 1,
                    paddingRight: 1,
                    borderRadius: 2,
                    backgroundColor: selectedLiveTimeRange === n ? blue.blue3 : undefined,
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedLiveTimeRange(selectedLiveTimeRange === n ? null : n)}
                >&#128467; {n}</button>
              ))}
            </div>
          </div>
        </div>

        <button
          style={{ width: 41, height: 41, fontSize: 32 }}
          onClick={() => setShowSettings(n => !n)}
        >&#9881;</button>
      </div>

      {showSettings ? (
        <div style={{
          position: 'absolute',
          top: 48,
          right: 0,
          marginTop: 8,
          marginRight: 8,
          backgroundColor: gray.gray1,
          border: `1px solid ${gray.gray12}`,
          borderRadius: 4,
          zIndex: 999,
          minWidth: 360,
          padding: 8,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <h3>Visualization Settings</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 16,
                height: 16,
                background: `linear-gradient(90deg, ${green.green8} 0%, ${green.green8} 32%, ${blue.blue8} 33%, ${blue.blue8} 65%, ${red.red8} 66%, ${red.red8} 50%)`,
                borderRadius: 4,
              }} />
              <label htmlFor="battles-box" style={{userSelect: 'none'}}>Show Battles:</label>
              <input id="battles-box" type="checkbox" checked={battlesVisible} onChange={e => setBattlesVisible(e.currentTarget.checked)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 16,
                height: 16,
                background: `linear-gradient(45deg, white 0%, white 19%, ${pink.pink8} 20%, ${pink.pink8} 39%, white 40%, white 59%, ${pink.pink8} 60%, ${pink.pink8} 79%, white 80%, white 89%, ${pink.pink8} 90%, ${pink.pink8} 100%)`,
                borderRadius: 4,
              }} />
              <label htmlFor="unassociatedparticipants-box" style={{userSelect: 'none'}}>Show Unassociated Participants:</label>
              <input id="unassociatedparticipants-box" type="checkbox" checked={unassociatedParticipantsVisible} onChange={e => setUnassociatedParticipantsVisible(e.currentTarget.checked)} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, border: `2px dashed ${red.red8}`, borderRadius: 4 }} />
              <label htmlFor="checkins-box" style={{userSelect: 'none'}}>Show Checkins:</label>
              <input id="checkins-box" type="checkbox" checked={checkinsVisible} onChange={e => setCheckinsVisible(e.currentTarget.checked)} />
            </div>

            <h4>Twilio</h4>
            <em style={{ width: 300, fontSize: 12 }}>
              Note: you must run a proxy server locally from http://localhost:3001 -&gt; https://www.twilio.com
              and select a duration less than 5 hours
            </em>
            {["audio" as const, "video" as const].map(trackType => (
              <Fragment key={trackType}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <label htmlFor={`twilio-${trackType}-box`} style={{userSelect: 'none'}}>Show twilio {trackType} data:</label>
                  <input
                    id={`twilio-${trackType}-box`}
                    type="checkbox"
                    disabled={!underFiveHoursSelected}
                    checked={!underFiveHoursSelected ? false : twilioMetricsVisible[trackType] !== null}
                    onChange={e => {
                      setTwilioMetricsVisible(n => ({
                        ...n,
                        [trackType]: e.currentTarget.checked ? { latency: false, packetsLost: false, bitrate: false } : null,
                      }));
                    }}
                  />
                </div>
                {twilioMetricsVisible[trackType] ? (
                  <Fragment>
                    {[
                      {field: "latency" as const, label: "Latency / Round Trip Time", color: pink.pink8},
                      {field: "bitrate" as const, label: "Sent Bitrate", color: purple.purple8},
                      {field: "packetsLost" as const, label: "Packets Lost %", color: cyan.cyan8},
                    ].map(({field, label, color}) => (
                      <div style={{ display: 'flex', justifyItems: 'center', gap: 8, marginLeft: 24 }} key={field}>
                        <div style={{ width: 16, height: 16, backgroundColor: color, borderRadius: 4 }} />
                        <label htmlFor={`twilio-${trackType}-${field}-box`} style={{userSelect: 'none'}}>Show {trackType} {label.toLowerCase()}:</label>
                        <input
                          id={`twilio-${trackType}-${field}-box`}
                          type="checkbox"
                          disabled={!underFiveHoursSelected}
                          checked={!underFiveHoursSelected ? false : twilioMetricsVisible[trackType]![field]}
                          onChange={e => setTwilioMetricsVisible(n => {
                            const base = n || {
                              video: { latency: false, packetsLost: false, bitrate: false },
                              audio: { latency: false, packetsLost: false, bitrate: false },
                            };

                            return {
                              ...base,
                              [trackType]: {
                                ...base[trackType],
                                [field]: e.currentTarget.checked,
                              },
                            };
                          })}
                        />
                      </div>
                    ))}
                  </Fragment>
                ) : null}
              </Fragment>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${gray.gray10}`, borderRadius: 4 }} />
              <label htmlFor="twilio-publisher-box" style={{userSelect: 'none'}}>Show twilio publisher info:</label>
              <input
                id="twilio-publisher-box"
                type="checkbox"
                disabled={!underFiveHoursSelected}
                checked={!underFiveHoursSelected ? false : twilioMetricsVisible?.publisherInfo}
                onChange={e => {
                  setTwilioMetricsVisible(n => ({ ...n, publisherInfo: e.currentTarget.checked }));
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 16, height: 16, backgroundColor: green.green8, borderRadius: 4 }} />
              <label htmlFor="twilio-bitrate-box" style={{userSelect: 'none'}}>Show twilio received bitrate info:</label>
              <input
                id="twilio-bitrate-box"
                type="checkbox"
                disabled={!underFiveHoursSelected}
                checked={!underFiveHoursSelected ? false : twilioMetricsVisible?.bitrate}
                onChange={e => {
                  setTwilioMetricsVisible(n => ({ ...n, bitrate: e.currentTarget.checked }));
                }}
              />
            </div>

            <h3>Display Settings</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <label htmlFor="checkins-box" style={{userSelect: 'none'}}>Height in px:</label>
              <NumberInput
                id="checkins-box"
                value={heightInPx}
                onChange={setHeightInPx}
              />
            </div>

            <a
              style={{ color: gray.gray10, textDecoration: 'underline', fontSize: 12 }}
              target="_blank"
              rel="noreferrer"
              href={`https://barz-battle-visualizer-old.surge.sh?baseurl=${baseUrl}&furthestbackdate=${startDate?.toISOString()}&furthestforwarddate=${endDate?.toISOString()}`}
            >Old visualizer</a>
          </div>
        </div>
      ) : null}
    </div>
  );

  switch (data.status) {
    case "IDLE":
    case "LOADING":
      return (
        <div style={{ height: '100vh' }}>
          {topBar}
          <p>Loading...</p>
        </div>
      );
    case "COMPLETE":
      if (!startDate || !endDate) {
        return <span>no start or end date set!</span>;
      }

      const participantsCurrentlyInMatching = data.participants.filter(p => p.connectionStatus === "ONLINE");
      const now = new Date();

      return (
        <div>
          {topBar}

          {selectedLiveTimeRange ? (
            <div style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              border: `1px solid ${red.red10}`,
              color: red.red10,
              padding: 6,
              borderRadius: 4,
              display: 'flex',
              gap: 6,
              alignItems: 'center',
              fontWeight: 'bold',
              backgroundColor: colorAlpha(red.red1, 0.8),
              userSelect: 'none',
            }}>
              <div style={{ width: 8, height: 8, backgroundColor: red.red10, borderRadius: 4 }} />
              Live
            </div>
          ) : null}

          <div style={{ position: 'relative', overflow: 'hidden' }}>
            <Chart
              startDate={startDate}
              endDate={endDate}

              heightInPx={heightInPx}

              battles={battlesVisible ? data.battles : []}
              participantsWithoutBattles={unassociatedParticipantsVisible ? data.participants : []}
              participantCheckinTimestamps={checkinsVisible ? data.participantCheckins : new Map()}
              participantTwilioMetrics={data.participantTwilioMetrics}
              twilioMetricsVisible={twilioMetricsVisible}

              onClickBattle={(battleId, e) => {
                if (e.metaKey || e.ctrlKey) {
                  window.open(`/new/battles/${battleId}?baseurl=${baseUrl}`, '_blank');
                } else {
                  router.push(`/new/battles/${battleId}?baseurl=${baseUrl}`)
                }
              }}
              onSelectTimespan={(start, end) => {
                setSelectedLiveTimeRange(null);
                setStartDate(start);
                setEndDate(end);
              }}
            />

            {participantsCurrentlyInMatching.length > 0 ? (
              <div style={{ border: `1px dashed ${gray.gray12}`, borderRadius: 4, padding: 4, maxWidth: 320, margin: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 14 }}>{participantsCurrentlyInMatching.length} participant(s) waiting for battle:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {participantsCurrentlyInMatching.map(participant => {
                    const lastCheckIn = (data.participantCheckins.get(participant.id) || []).at(-1);
                    return (
                      <div key={participant.id} style={{ display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
                        <img src={participant.user.profileImageUrl || undefined} style={{ width: 64, height: 64 }} />
                        <span style={{ fontSize: 12 }}>{participant.user.handle}</span>
                        <span style={{ fontSize: 6 }}>{participant.user.id}</span>
                        <span style={{ fontSize: 10 }}>
                          Clout Score:<br/>
                          {participant.user.computedScore}
                        </span>
                        <span style={{ fontSize: 10 }}>
                          Elapsed:<br/ >
                          {round((now.getTime() - parseISO(participant.createdAt).getTime()) / 1000, 3)} sec
                        </span>
                        {/* <span style={{ fontSize: 10 }}> */}
                        {/*   Last Check In:<br/> */}
                        {/*   {lastCheckIn ? `${round((now.getTime() - lastCheckIn.getTime()) / 1000, 3)} sec ago` : 'N/A'} */}
                        {/* </span> */}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      );
    case "ERROR":
      return (
        <div style={{ height: '100vh' }}>
          {topBar}
          <p>Error loading!</p>
        </div>
      );
  }
}
