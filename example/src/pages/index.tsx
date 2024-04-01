import { Fragment, createContext, useContext, useState, useEffect, useMemo } from 'react';
import ReactDatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { addHours, addMilliseconds, parseISO, subHours, format, subWeeks } from 'date-fns';
import Head from 'next/head';
import colorToRgba from 'color-rgba';
// import colorAlpha from 'color-alpha';
import {
  gray,
  blue,
  red,
  green,
  yellow,
  purple,
  pink,
  cyan,
} from '@radix-ui/colors';
import { useRouter } from 'next/router';

// The amount of time that a user must be offline before they automatically forfeit the battle
const BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS = 5.0;

// FIXME: import these types directly from the server code once that is brought into the monorepo
// project
type Battle = {
  id: string;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  madeInactiveAt: string | null;
  madeInactiveReason: string | null;
  numberOfRounds: number;
  turnLengthSeconds: number;
  warmupLengthSeconds: number;
  twilioRoomName: string;
  beatId: string | null;
  votingEndsAt: string | null;
  computedPrivacyLevel: 'PRIVATE' | 'PUBLIC';

  exportedVideoStatus:
    | 'QUEUING'
    | 'DOWNLOADING'
    | 'COMPOSITING'
    | 'UPLOADING'
    | 'COMPLETED'
    | 'ERROR'
    | 'DISABLED'
    | null;
  exportedVideoKey: string | null;
  exportedVideoQueuedAt: string | null;
  exportedVideoStartedAt: string | null;
  exportedVideoCompletedAt: string | null;
};

type BattleParticipant = {
  id: string;
  createdAt: string;
  updatedAt: string;
  associatedWithBattleAt: string | null;
  // lastCheckedInAt: string;
  connectionStatus: 'UNKNOWN' | 'ONLINE' | 'OFFLINE';
  initialMatchFailed: boolean;
  battleId: string | null;
  readyForBattleAt: string | null;
  requestedBattlePrivacyLevel: 'PRIVATE' | 'PUBLIC' | null;
  twilioAudioTrackId: string | null;
  twilioVideoTrackId: string | null;
  twilioDataTrackId: string | null;
  forfeitedAt: string | null;
  videoStreamingStartedAt: string | null;
  madeInactiveAt: string | null;
  madeInactiveReason: string | null;
  currentState: string;
  currentContext: object;
  userId: string;
  order: number | null;
  appState: string | null;
  twilioCompositionSid: string | null;
  twilioCompositionStatus: string | null;
  user: User;
};

type User = {
  id: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  computedScore: number;
  computedFollowersCount: number;
  computedFollowingCount: number;
};

type BattleParticipantCheckin = {
  id: string;
  createdAt: string;
  updatedAt: string;
  checkedInAt: string;
  battleParticipantId: string;
  state: string;
  context: object;
};

type BattleParticipantStateMachineEvent = {
  id: string;
  createdAt: string;
  updatedAt: string;
  battleId: string;
  clientGeneratedUuid: string;
  triggeredByParticipantId: string;
  payload: object;
};

type BattleWithParticipants = Battle & {
  participants: Array<Omit<BattleParticipant, 'battleId'>>;
};

type BattleWithParticipantsAndCheckinsAndEvents = Battle & {
  participants: Array<
    Omit<BattleParticipant, 'battleId'> & {
      checkins: Array<
        Pick<
          BattleParticipantCheckin,
          'id' | 'createdAt' | 'updatedAt' | 'checkedInAt' | 'state' | 'context'
        >
      >;
    }
  >;
  stateMachineEvents: Array<
    Pick<
      BattleParticipantStateMachineEvent,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'clientGeneratedUuid'
      | 'triggeredByParticipantId'
      | 'payload'
    >
  >;
};

const round = (value: number, places: number = 0) => {
  const multiplier = Math.pow(10, places);
  return Math.round(value * multiplier) / multiplier;
};

const WIDTH_PX = 3600;
const OUTER_PADDING_Y_PX = 16;
const OUTER_PADDING_X_PX = 4;
const TRACK_HEIGHT_PX = 64;
const TIME_LEGEND_HEIGHT_PX = 28;
const TIME_LEGEND_MIN_DISTANCE_BETWEEN_TICKS_SECONDS = 7 * 24 * 60 * 60;
const TIME_LEGEND_AFTER_BATTLE_COMPLETE_SCALE_PADDING_SECONDS = 2;

const GraphContext = createContext<{
  battles: Array<BattleWithParticipantsAndCheckinsAndEvents>;
  tracksHeightInPx: number;
  widthInPx: number;
  heightInPx: number;

  startDate: Date;
  endDate: Date;
  timelineLengthInMilliseconds: number;

  xPixelsPerSecond: number;
} | null>(null);

function LineWithCircle({ position, height, color, label, dashed }: { position: number, height: number, color: string, label?: string, dashed?: boolean }) {
  const radius = label ? 6 : 4;
  return (
    <g>
      <line
        x1={position}
        y1={0}
        x2={position}
        y2={(height/2)-radius}
        stroke={color}
        strokeDasharray={dashed ? "2 2" : undefined}
      />
      <circle
        cx={position}
        cy={height/2}
        fill={label ? "white" : "transparent"}
        stroke={color}
        strokeDasharray={dashed ? "2 2" : undefined}
        r={radius}
      />
      {label ? <text
        transform={`translate(${position},${(height/2)+0.5})`}
        textAnchor="middle"
        alignmentBaseline="middle"
        fontSize={12}
        fill={color}
        style={{ userSelect: 'none' }}
      >{label}</text> : null}
      <line
        x1={position}
        y1={(height/2)+radius}
        x2={position}
        y2={height}
        stroke={color}
        strokeDasharray={dashed ? "2 2" : undefined}
      />
    </g>
  );
}

const DatePicker: React.FunctionComponent<{ value: string | null, onChange: (date: Date) => void}> = ({ value, onChange }) => {
  const [date, setDate] = useState<Date | null>(null);
  useEffect(() => {
    if (!value) {
      setDate(null);
    } else {
      const result = parseISO(value);
      setDate(result);
    }
  }, [value]);

  return (
    <ReactDatePicker
      selected={date}
      showTimeSelect
      onChange={(newDate: Date) => {
        setDate(newDate);
        onChange(newDate);
      }}
    />
  );
};

export default function Web() {
  const router = useRouter();

  let [workingBaseUrl, setWorkingBaseUrl] = useState<string>('https://api.rapbattleapp.com');
  let [baseUrl, setBaseUrl] = useState<string>('https://api.rapbattleapp.com');
  const [furthestForwardDate, setFurthestForwardDate] = useState<Date | null>(null);
  const [furthestBackDate, setFurthestBackDate] = useState<Date | null>(null);

  const defaultFurthestBackDate = useMemo(() => subWeeks(new Date(), 1), []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const baseUrl = params.get("baseurl") || "https://api.rapbattleapp.com";

    // NOTE: the old battle visualizer used to be at this url. If there is a battle id query param,
    // then redirect to the new location of this at /battles
    const battleId = params.get("battleid") || null;
    if (battleId) {
      const newPath = `/battles?battleid=${battleId}&baseurl=${baseUrl}`;
      console.warn(`Note: redirecting to new url at ${newPath}`)
      router.replace(newPath);
      return;
    }

    setWorkingBaseUrl(baseUrl);
    setBaseUrl(baseUrl);

    const furthestBackDateRaw = params.get("furthestbackdate");
    setFurthestBackDate(furthestBackDateRaw ? parseISO(furthestBackDateRaw) : null);

    const furthestForwardDateRaw = params.get("furthestforwarddate");
    setFurthestForwardDate(furthestForwardDateRaw ? parseISO(furthestForwardDateRaw) : null);
  }, []);

  const [workingTimelineZoom, setWorkingTimelineZoom] = useState('1');
  const [timelineZoom, setTimelineZoom] = useState(1);

  const [battles, setBattles] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | { status: "COMPLETE", total: number, battles: Array<BattleWithParticipantsAndCheckinsAndEvents> }
    | { status: "ERROR", error: Error }
  >({status: "IDLE"});

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;

    const furthestBackDateOrDefault = furthestBackDate || defaultFurthestBackDate;
    console.log('FOO:', furthestBackDateOrDefault);

    // Step 1: fetch initial list of battles
    (async () => {
      setBattles({ status: "LOADING" });

      let battlesTotal = 0;
      let battles: Array<BattleWithParticipantsAndCheckinsAndEvents> = [];

      let page = 0;
      while (true) {
        page += 1;
        const battleResponse = await fetch(`${baseUrl}/v1/battles?page=${page}`);
        if (!battleResponse.ok) {
          throw new Error(
            `Error fetching battles page ${page}: ${
              battleResponse.status
            } ${await battleResponse.text()}`,
          );
        }
        const body = await battleResponse.json();

        // FIXME: this could be wrong if `furthestBackDateOrDefault` is set!
        battlesTotal = body.total;

        // Only add battles that were created before `furthestBackDateHit`
        let furthestBackDateHit = false;
        for (const battle of body.results) {
          if (furthestForwardDate && parseISO(battle.createdAt) > furthestForwardDate) {
            // Disregard, but keep seeking forward
            break;
          }
          if (furthestBackDateOrDefault && parseISO(battle.createdAt) < furthestBackDateOrDefault) {
            // Disregard and don't fetch any more battles
            furthestBackDateHit = true;
            break;
          }
          battles.unshift(battle);
        }

        if (!body.next || furthestBackDateHit) {
          break;
        }
      }

      setBattles({ status: "COMPLETE", total: battlesTotal, battles });

      let previouslyFetchedBattleIds = new Set(battles.map(b => b.id));

      // // Step 2: every few seconds, refetch battles until a battle is found that has already been
      // // loaded.
      // intervalId = setInterval(() => {
      //   (async () => {
      //     let newBattles: Array<BattleWithParticipantsAndCheckinsAndEvents> = [];
      //     for (let page = 1; ; page += 1) {
      //       const battleResponse = await fetch(`${baseUrl}/v1/battles?page=${page}`);
      //       if (!battleResponse.ok) {
      //         throw new Error(
      //           `Error fetching new battles page ${page}: ${
      //             battleResponse.status
      //           } ${await battleResponse.text()}`,
      //         );
      //       }

      //       const body = await battleResponse.json();
      //       let finishedEarly = false;
      //       for (const battle of body.results) {
      //         if (previouslyFetchedBattleIds.has(battle.id)) {
      //           finishedEarly = true;
      //           break;
      //         }
      //         previouslyFetchedBattleIds.add(battle.id);

      //         if (furthestForwardDate && parseISO(battle.createdAt) > furthestForwardDate) {
      //           // Disregard - this battle was too new
      //           break;
      //         }
      //         if (furthestBackDateOrDefault && parseISO(battle.createdAt) < furthestBackDateOrDefault) {
      //           // Disregard - this battle was too old
      //           break;
      //         }

      //         newBattles.unshift(battle);
      //       }
      //       if (!body.next || finishedEarly) {
      //         break;
      //       }
      //     }

      //     if (newBattles.length === 0) {
      //       return;
      //     }

      //     setBattles(old => {
      //       if (old.status !== "COMPLETE") {
      //         return old;
      //       }

      //       return { ...old, total: old.total + newBattles.length, battles: [...newBattles, ...old.battles] };
      //     });
      //   })().catch(error => {
      //     setBattles({ status: "ERROR", error });
      //     if (intervalId) {
      //       clearInterval(intervalId);
      //       intervalId = null;
      //     }
      //   });
      // }, 5000);
    })().catch(error => {
      setBattles({ status: "ERROR", error });

      if (intervalId) {
        clearInterval(intervalId);
      }
    });

    return () => {
      if (!intervalId) {
        return;
      }
      clearInterval(intervalId);
    };
  }, [baseUrl, furthestBackDate, defaultFurthestBackDate, furthestForwardDate]);

  const [participants, setParticipants] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | { status: "COMPLETE", total: number, participants: Array<BattleParticipant>, participantCheckinTimestamps: Map<BattleParticipant['id'], Array<Date>> }
    | { status: "ERROR", error: Error }
  >({status: "IDLE"});

  useEffect(() => {
    setParticipants({ status: "LOADING" });
    let intervalId: NodeJS.Timeout | null = null;

    const furthestBackDateOrDefault = furthestBackDate || defaultFurthestBackDate;

    // Step 1: fetch initial list of participants
    (async () => {
      let participantsTotal = 0;

      let participants: Array<BattleParticipant> = [];
      for (let page = 1; ; page += 1) {
        const participantResponse = await fetch(`${baseUrl}/v1/participants?page=${page}`);
        if (!participantResponse.ok) {
          throw new Error(
            `Error fetching participants page ${page}: ${
              participantResponse.status
            } ${await participantResponse.text()}`,
          );
        }
        const body = await participantResponse.json();

        // FIXME: this could be wrong if `furthestBackDate` is set!
        participantsTotal = body.total;

        // Only add participants that were created before `furthestBackDateHit`
        let furthestBackDateHit = false;
        for (const participant of body.results) {
          if (furthestForwardDate && parseISO(participant.createdAt) > furthestForwardDate) {
            // Disregard, but keep seeking forward
            break;
          }
          if (furthestBackDateOrDefault && parseISO(participant.createdAt) < furthestBackDateOrDefault) {
            // Disregard and don't fetch any more battles
            furthestBackDateHit = true;
            break;
          }
          participants.unshift(participant);
        }

        if (!body.next || furthestBackDateHit) {
          break;
        }
      }

      const participantCheckinTimesResponse = await fetch(
        `${baseUrl}/v1/participants/checkin-times?ids=${participants.map(p => p.id).join(',')}`
      );
      if (!participantCheckinTimesResponse.ok) {
        throw new Error(
          `Error fetching participants checkin times: ${
            participantCheckinTimesResponse.status
          } ${await participantCheckinTimesResponse.text()}`,
        );
      }
      const checkinTimesRaw = await participantCheckinTimesResponse.json() as { results: { [id: string]: Array<string> }};
      const checkinTimesEntries = Object.entries(checkinTimesRaw.results)
        .map(([participantId, checkinTimestamps]) => [
          participantId,
          checkinTimestamps.map(t => parseISO(t))
        ] as [string, Array<Date>]);

      console.log(checkinTimesEntries)

      setParticipants({
        status: "COMPLETE",
        total: participantsTotal,
        participants,
        participantCheckinTimestamps: new Map(checkinTimesEntries)
      });

      let previouslyFetchedParticipants = new Set(participants.map(b => b.id));

      // // Step 2: every few seconds, refetch participants until a participant is found that has already been
      // // loaded.
      // intervalId = setInterval(() => {
      //   (async () => {
      //     let newParticipants: Array<BattleParticipant> = [];
      //     for (let page = 1; ; page += 1) {
      //       const participantsResponse = await fetch(`${baseUrl}/v1/participants?page=${page}`);
      //       if (!participantsResponse.ok) {
      //         throw new Error(
      //           `Error fetching new participants page ${page}: ${
      //             participantsResponse.status
      //           } ${await participantsResponse.text()}`,
      //         );
      //       }

      //       const body = await participantsResponse.json();
      //       let finishedEarly = false;
      //       for (const participant of body.results) {
      //         if (previouslyFetchedParticipants.has(participant.id)) {
      //           finishedEarly = true;
      //           break;
      //         }
      //         previouslyFetchedParticipants.add(participant.id);

      //         if (furthestForwardDate && parseISO(participant.createdAt) > furthestForwardDate) {
      //           // Disregard - this participant was too new
      //           break;
      //         }
      //         if (furthestBackDateOrDefault && parseISO(participant.createdAt) < furthestBackDateOrDefault) {
      //           // Disregard - this participant was too old
      //           break;
      //         }

      //         newParticipants.unshift(participant);
      //       }
      //       if (!body.next || finishedEarly) {
      //         break;
      //       }
      //     }

      //     if (newParticipants.length === 0) {
      //       return;
      //     }

      //     setParticipants(old => {
      //       if (old.status !== "COMPLETE") {
      //         return old;
      //       }

      //       return { ...old, total: old.total + newParticipants.length, participants: [...newParticipants, ...old.participants] };
      //     });
      //   })().catch(error => {
      //     setParticipants({ status: "ERROR", error });
      //     if (intervalId) {
      //       clearInterval(intervalId);
      //       intervalId = null;
      //     }
      //   });
      // }, 5000);
    })().catch(error => {
      setParticipants({ status: "ERROR", error });

      if (intervalId) {
        clearInterval(intervalId);
      }
    });

    return () => {
      if (!intervalId) {
        return;
      }
      clearInterval(intervalId);
    };
  }, [baseUrl, defaultFurthestBackDate, furthestBackDate, furthestForwardDate]);

  const participantsWithoutBattles = useMemo(() => {
    if (battles.status !== 'COMPLETE') {
      return [];
    }
    if (participants.status !== 'COMPLETE') {
      return [];
    }

    const participantsIdsInBattles = new Set(battles.battles.flatMap(b => b.participants.map(p => p.id)));

    return participants.participants.filter(p => !participantsIdsInBattles.has(p.id));
  }, [battles, participants]);

  const binPackedTracks = useMemo(() => {
    const binPackedTracks: Array<Array<
      { start: Date, end: Date, type: "battle", object: BattleWithParticipantsAndCheckinsAndEvents } |
      { start: Date, end: Date, type: "participant", object: BattleParticipant }
    >> = [];
    if (battles.status !== "COMPLETE") {
      return binPackedTracks;
    }

    for (const {type, battleOrParticipant} of [
      ...participantsWithoutBattles.map(p => ({type: "participant" as const, battleOrParticipant: p})),
      ...battles.battles.map(b => ({type: "battle" as const, battleOrParticipant: b})),
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
          completedAt = parseISO(battleOrParticipant.updatedAt);
          break;
      }

      // Attempt to fit this battle into the track somewhere
      let added = false;
      for (let trackIndex = 0; trackIndex < binPackedTracks.length; trackIndex += 1) {
        const track = binPackedTracks[trackIndex];
        // console.log('--- track:', trackIndex);

        let isBeforeOrAfterAll = true;
        for (const { start, end } of track) {
          const startWithMargin = subHours(start, 0.1);
          const endWithMargin = addHours(end, 0.1);
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
  }, [battles, participantsWithoutBattles])

  const top = (
    <div>
      <Head>
        <title>Battle Overview</title>
      </Head>

      <h1>Barz Battle Overview</h1>

      <br />
      Base URL:
      <input
        type="text"
        value={workingBaseUrl}
        onChange={e => setWorkingBaseUrl(e.target.value)}
        onBlur={() => {
          setBaseUrl(workingBaseUrl)

          const url = new URL(window.location.href);
          url.searchParams.set("baseurl", workingBaseUrl);
          history.pushState({}, "", url.toString());
        }}
      />
      <br />
      Filter start date (in utc, defaults to 1 week ago):
      <DatePicker
        value={furthestBackDate ? furthestBackDate.toISOString() : null}
        onChange={date => {
          setFurthestBackDate(date);

          const url = new URL(window.location.href);
          if (date) {
            url.searchParams.set("furthestbackdate", date.toISOString());
          } else {
            url.searchParams.delete("furthestforwarddate");
          }
          history.pushState({}, "", url.toString());
        }}
      />
      <br />
      Filter end date (in utc, defaults to now):
      <DatePicker
        value={furthestForwardDate ? furthestForwardDate.toISOString() : null}
        onChange={date => {
          setFurthestForwardDate(date);

          const url = new URL(window.location.href);
          if (date) {
            url.searchParams.set("furthestforwarddate", date.toISOString());
          } else {
            url.searchParams.delete("furthestforwarddate");
          }
          history.pushState({}, "", url.toString());
        }}
      />
    </div>
  );

  switch (battles.status) {
    case "IDLE":
      return top;
    case "LOADING":
      return (
        <div>
          {top}
          <br />
          Loading...
        </div>
      );
    case "ERROR":
      return (
        <div>
          {top}
          <br />
          Error: {battles.error.message}
        </div>
      );
    case "COMPLETE":
      if (participants.status !== 'COMPLETE') {
        return (
          <div>
            {top}
            <br />
            Participants: {participants.status}
          </div>
        );
      }
      if (battles.battles.length === 0) {
        return (
          <div>
            {top}
            <br />
            No battles found!
          </div>
        );
      }

      const tracksHeightInPx = binPackedTracks.length * TRACK_HEIGHT_PX;
      const heightInPx = tracksHeightInPx + TIME_LEGEND_HEIGHT_PX;

      const startDate = furthestBackDate || parseISO(battles.battles.at(-1)!.createdAt);
      const endDate = furthestForwardDate || parseISO(battles.battles[0].completedAt || battles.battles[0].updatedAt);

      const timelineLengthInMilliseconds = (
        endDate.getTime() - startDate.getTime()
      ) + (TIME_LEGEND_AFTER_BATTLE_COMPLETE_SCALE_PADDING_SECONDS * 1000);

      const widthInPixels = WIDTH_PX * timelineZoom;

      const xPixelsPerMillisecond = widthInPixels / timelineLengthInMilliseconds;

      const scale: Array<number> = [];
      const foo = TIME_LEGEND_MIN_DISTANCE_BETWEEN_TICKS_SECONDS / timelineZoom * 10000000;
      for (let i = 0; i < timelineLengthInMilliseconds; i += foo) {
        scale.push(i);
      }

      return (
        <GraphContext.Provider value={{
          battles: battles.battles,
          tracksHeightInPx,
          widthInPx: widthInPixels,
          heightInPx,
          startDate,
          endDate,
          timelineLengthInMilliseconds,
          xPixelsPerSecond: xPixelsPerMillisecond,
        }}>
          <div>
            {top}

            <br />
            Timeline Zoom Multiplier: <input
              type="number"
              value={workingTimelineZoom}
              onChange={e => setWorkingTimelineZoom(e.target.value)}
              onBlur={() => {
                const zoom = parseFloat(workingTimelineZoom);
                if (isNaN(zoom)) {
                  setWorkingTimelineZoom(`${timelineZoom}`);
                  return;
                }
                setTimelineZoom(zoom);
              }}
            />

            <br />
            <br />

            <h5 style={{ marginBottom: 8 }}>Timeline Legend</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                [gray.gray12, "Participant Created At", true],
                [green.green8, "Participant Assigned to Battle At", false],
                [blue.blue8, "Participant Ready For Battle At", false],
                [red.red9, "Battle Start -> Complete", true],
                [yellow.yellow8, "Battle Forfeited At", true],
              ].map(([color, label, dashed]) => (
                <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 16, height: 16, border: `2px ${dashed ? "dashed" : "solid"} ${color}`, borderRadius: 4 }} />
                  <span style={{ fontSize: 12 }}>{label}</span>
                </div>
              ))}
            </div>

            <br />
            <br />

            <h2>Timeline</h2>

            <div style={{ overflowY: 'auto' }}>
              <svg
                width={widthInPixels + OUTER_PADDING_X_PX + OUTER_PADDING_X_PX}
                height={heightInPx + OUTER_PADDING_Y_PX + OUTER_PADDING_Y_PX}
                viewBox={`0 0 ${widthInPixels + OUTER_PADDING_X_PX + OUTER_PADDING_X_PX} ${heightInPx + OUTER_PADDING_Y_PX + OUTER_PADDING_Y_PX}`}
                style={{fontFamily: 'monospace'}}
              >
                <pattern id="hatch-forfeit" width="9" height="1" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
                  <rect x="0" y="0" width="3" height="1" fill={yellow.yellow8} />
                  <rect x="3" y="0" width="9" height="1" fill="transparent" />
                </pattern>

                <g transform={`translate(${OUTER_PADDING_X_PX},${OUTER_PADDING_Y_PX})`}>
                  {binPackedTracks.map((track, index) => {
                    const isEven = index % 2 === 0;

                    return (
                      <g key={index} transform={`translate(0,${index * TRACK_HEIGHT_PX})`}>
                        {/* background color */}
                        <rect
                          x={-1 * OUTER_PADDING_X_PX}
                          y={0}
                          width={widthInPixels + OUTER_PADDING_X_PX + OUTER_PADDING_X_PX}
                          height={TRACK_HEIGHT_PX}
                          fill={isEven ? 'white' : 'rgba(0,0,0,0.01)'}
                        />
                        {track.map(({ type, object }) => {
                          const renderParticipant = (
                            battle: BattleWithParticipantsAndCheckinsAndEvents | null,
                            participant: Omit<BattleParticipant, "battleId">,
                            participantIndex: number,
                          ) => {
                            const battleParticipantsLength = battle ? battle.participants.length : 2;
                            const participantHeightPx = TRACK_HEIGHT_PX / battleParticipantsLength;
                            const participantYPx = (participantIndex / battleParticipantsLength) * TRACK_HEIGHT_PX;

                            const participantCreatedAtPosition = (
                              parseISO(participant.createdAt).getTime() - startDate.getTime()
                            ) * xPixelsPerMillisecond;

                            const participantMatchedAtPosition = participant.associatedWithBattleAt ? (
                              parseISO(participant.associatedWithBattleAt).getTime() - startDate.getTime()
                            ) * xPixelsPerMillisecond : null;

                            const participantReadyAtPosition = participant.readyForBattleAt ? (
                              parseISO(participant.readyForBattleAt).getTime() - startDate.getTime()
                            ) * xPixelsPerMillisecond : null;

                            return (
                              <g transform={`translate(0,${participantYPx})`}>
                                <image
                                  href={participant.user.profileImageUrl || undefined}
                                  x={participantCreatedAtPosition - 24}
                                  y={(participantHeightPx - 24) / 2}
                                  height={24}
                                  width={24}
                                />
                                {participantCreatedAtPosition && participantMatchedAtPosition && participantMatchedAtPosition > participantCreatedAtPosition ? (
                                  <rect
                                    x={participantCreatedAtPosition}
                                    y={0}
                                    width={participantMatchedAtPosition - participantCreatedAtPosition}
                                    height={participantHeightPx}
                                    fill={green.green8}
                                    opacity={0.2}
                                  />
                                ) : null}

                                {participantReadyAtPosition ? (
                                  <LineWithCircle
                                    position={participantReadyAtPosition}
                                    height={participantHeightPx}
                                    color={blue.blue8}
                                  />
                                ) : null}

                                {participantMatchedAtPosition ? (
                                  <LineWithCircle
                                    position={participantMatchedAtPosition}
                                    label={participant.initialMatchFailed ? "B" : "L"}
                                    height={participantHeightPx}
                                    color={green.green8}
                                  />
                                ) : null}

                                <line
                                  x1={participantCreatedAtPosition}
                                  y1={0}
                                  x2={participantCreatedAtPosition}
                                  y2={participantHeightPx}
                                  stroke={gray.gray12}
                                  strokeDasharray="2 2"
                                />

                                {(participants.participantCheckinTimestamps.get(participant.id) || []).map(checkinTimestamp => {
                                  const position = (checkinTimestamp.getTime() - startDate.getTime()) * xPixelsPerMillisecond;

                                  return (
                                    <line
                                      x1={position}
                                      y1={0}
                                      x2={position}
                                      y2={TRACK_HEIGHT_PX/2}
                                      stroke={red.red8}
                                      strokeDasharray="2 2"
                                    />
                                  );
                                })}

                              </g>
                            );
                          };

                          switch (type) {
                            case "battle": {
                              const battle = object;
                              const battleCreatedAtPosition = (
                                parseISO(battle.createdAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond;

                              const battleStartedAtPosition = battle.startedAt ? (
                                parseISO(battle.startedAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond : null;

                              const battleForfeitedAtPosition = battle.madeInactiveAt ? (
                                parseISO(battle.madeInactiveAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond : null;

                              const battleCompletedAtPosition = battle.completedAt ? (
                                parseISO(battle.completedAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond : null;

                              return (
                                <g
                                  key={battle.id}
                                  data-type={type}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => window.open(`/battles?battleid=${battle.id}&baseurl=${baseUrl}`, '_blank')}
                                >
                                  <text
                                    transform={`translate(${battleCreatedAtPosition-6},8)`}
                                    textAnchor="end"
                                    fontSize={8}
                                    fill={gray.gray8}
                                    textDecoration="underline"
                                  >{battle.id}</text>

                                  {battle.participants.sort((a, b) => (a.order || 0) - (b.order || 0)).map((participant, participantIndex) => {
                                    return renderParticipant(battle, participant, participantIndex);
                                  })}

                                  {/* show shaded region for battle length */}
                                  {battleStartedAtPosition && battleCompletedAtPosition && battleCompletedAtPosition > battleStartedAtPosition ? (
                                    <rect
                                      x={battleStartedAtPosition}
                                      y={0}
                                      width={battleCompletedAtPosition - battleStartedAtPosition}
                                      height={TRACK_HEIGHT_PX}
                                      fill={red.red8}
                                      opacity={0.2}
                                    />
                                  ) : null}
                                  {battleStartedAtPosition ? (
                                    <line
                                      x1={battleStartedAtPosition}
                                      y1={0}
                                      x2={battleStartedAtPosition}
                                      y2={TRACK_HEIGHT_PX}
                                      strokeDasharray="2 2"
                                      stroke={red.red8}
                                    />
                                  ) : null}
                                  {battleCompletedAtPosition ? (
                                    <line
                                      x1={battleCompletedAtPosition}
                                      y1={0}
                                      x2={battleCompletedAtPosition}
                                      y2={TRACK_HEIGHT_PX}
                                      strokeDasharray="2 2"
                                      stroke={red.red8}
                                    />
                                  ) : null}

                                  {/* If a forfeit happens, show that it happened */}
                                  {battleForfeitedAtPosition ? (
                                    <Fragment>
                                      <line
                                        x1={battleForfeitedAtPosition}
                                        y1={0}
                                        x2={battleForfeitedAtPosition}
                                        y2={TRACK_HEIGHT_PX}
                                        strokeDasharray="2 2"
                                        stroke={yellow.yellow8}
                                      />
                                      {battle.madeInactiveReason === "AUTO_FORFEIT_DUE_TO_INACTIVITY" ? (
                                        <rect
                                          x={battleForfeitedAtPosition - (BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS * xPixelsPerMillisecond)}
                                          y={0}
                                          width={10_000 * xPixelsPerMillisecond}
                                          height={TRACK_HEIGHT_PX}
                                          fill="url(#hatch-forfeit)"
                                          opacity={0.5}
                                        />
                                      ) : null}
                                    </Fragment>
                                  ) : null}
                                </g>
                              );
                            }

                            case "participant": {
                              const participant = object;

                              const participantCreatedAtPosition = (
                                parseISO(participant.createdAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond;

                              const participantForfeitedAtPosition = participant.madeInactiveAt ? (
                                parseISO(participant.madeInactiveAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond : null;

                              const participantIndex = participants.participants.indexOf(participant);
                              const nextParticipantCreatedBySameUser = participants.participants
                                .slice(participantIndex+1)
                                .find(p => p.user.id === participant.user.id);

                              const nextParticipantCreatedBySameUserCreatedAtPosition = nextParticipantCreatedBySameUser ? (
                                parseISO(nextParticipantCreatedBySameUser.createdAt).getTime() - startDate.getTime()
                              ) * xPixelsPerMillisecond : null;

                              return <g data-type={type}>
                                <text
                                  transform={`translate(${participantCreatedAtPosition-6},8)`}
                                  textAnchor="end"
                                  fontSize={8}
                                  fill={gray.gray8}
                                >{participant.id}</text>

                                {renderParticipant(null, participant, 0)}

                                {nextParticipantCreatedBySameUserCreatedAtPosition ? (
                                  <rect
                                    x={participantCreatedAtPosition}
                                    y={0}
                                    width={nextParticipantCreatedBySameUserCreatedAtPosition - participantCreatedAtPosition}
                                    height={TRACK_HEIGHT_PX / 2}
                                    fill={pink.pink8}
                                    opacity={0.2}
                                  />
                                ) : null}

                                {participantForfeitedAtPosition ? (
                                  <LineWithCircle
                                    position={participantForfeitedAtPosition}
                                    height={TRACK_HEIGHT_PX / 2}
                                    label={participant.madeInactiveReason === "AUTO_FORFEIT_DUE_TO_INACTIVITY" ? "X" : ""}
                                    color={red.red8}
                                  />
                                ) : null}
                              </g>;
                            }
                          }
                        })}
                      </g>
                    );
                  })}

                  {/* Render the x scale along the bottom */}
                  <g transform={`translate(0,${tracksHeightInPx})`}>
                    {scale.map((value, index) => (
                      <g
                        key={value}
                        transform={`translate(${value * xPixelsPerMillisecond},0)`}
                      >
                        <line x1={0} y1={0} x2={0} y2={6} strokeWidth={2} stroke="black" />
                        <text
                          textAnchor={index > 0 ? (index === scale.length-1 ? 'end' : 'middle') : 'start'}
                          transform={`translate(0,${TIME_LEGEND_HEIGHT_PX-4})`}
                          fontSize={12}
                      >{format(addMilliseconds(startDate, value), 'MM-dd-yy hh:mm:ss a')}</text>
                      </g>
                    ))}
                  </g>

                  {/* If the battle has not completed, show that in the corner */}
                  <g transform={`translate(${widthInPixels - 48},0)`}>
                    <rect x={0} y={0} width={48} height={24} fill="rgba(255,0,0,0.8)" rx={4} ry={4} />
                    <text transform="translate(9,16)" fill="white">LIVE</text>
                  </g>
                </g>
              </svg>
            </div>
          </div>
        </GraphContext.Provider>
      );
  }
}
