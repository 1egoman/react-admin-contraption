import { Fragment, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ScaleTime, scaleTime } from 'd3';
import { gray, red, blue, yellow, pink, green, purple } from '@radix-ui/colors'; 
// @ts-ignore
import colorAlpha from "color-alpha";
import { parseISO, subSeconds } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useRouter } from 'next/router';
import * as TwilioVideo from 'twilio-video';

import {
  AxisBottom,
  ChartAutoWidthResizer,
  Line,
  Region,
  RulesBottom,
  Track,
  boundariesInRange,
} from "@/charts";
import { BattleWithParticipantsAndCheckinsAndEvents, BattleRecording } from '@/types';
import { useParams } from 'next/navigation';

const TwilioVideoTrackVideo: React.FunctionComponent<{
  track: TwilioVideo.RemoteVideoTrack,
  sizeInPx: number,
}> = ({ track, sizeInPx }) => {
  const ref = useRef<HTMLVideoElement | null>(null!);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    el.muted = true;
    track.attach(el);

    return () => {
      track.detach(el);

      // This addresses a Chrome issue where the number of WebMediaPlayers is limited.
      // See: https://github.com/twilio/twilio-video.js/issues/1528
      el.srcObject = null;
    };
  }, [track]);

  return (
    <video
      ref={ref}
      style={{
        transform: 'scaleX(-1)',
        width: sizeInPx,
        height: sizeInPx,
        objectFit: 'cover',
      }}
    />
  );
};

const TwilioVideoTrackAudio: React.FunctionComponent<{
  track: TwilioVideo.RemoteAudioTrack,
}> = ({ track }) => {
  const audioEl = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioEl.current = track.attach();
    document.body.appendChild(audioEl.current);

    return () => {
      track.detach().forEach(el => {
        el.remove();

        // This addresses a Chrome issue where the number of WebMediaPlayers is limited.
        // See: https://github.com/twilio/twilio-video.js/issues/1528
        el.srcObject = null;
      });
    };
  }, [track]);

  return null;
};

const TwilioVideoLiveView: React.FunctionComponent<{
  baseUrl: string | null,
  battle: BattleWithParticipantsAndCheckinsAndEvents,
}> = ({
  baseUrl,
  battle,
}) => {
  const identity = useMemo(() => `visualizer-guest-${Math.random()}`, []);

  const [audioEnabled, setAudioEnabled] = useState(false);

  const [twilioState, setTwilioState] = useState<
    | { status: 'IDLE' }
    | { status: 'READY' }
    | { status: 'LOADING' }
    | { status: 'CONNECTED', room: TwilioVideo.Room }
    | { status: 'ERROR' }
  >({ status: 'IDLE' });

  const connectingRef = useRef(false);

  const isReady = twilioState.status !== "IDLE";
  useEffect(() => {
    if (!baseUrl) {
      return;
    }
    if (!isReady) {
      return;
    }
    if (connectingRef.current) {
      return;
    }

    setTwilioState({ status: 'LOADING' });

    let disconnect: (() => void) | null = null;

    connectingRef.current = true;

    fetch(`${baseUrl}/twilio-token/${battle.twilioRoomSid}/${identity}`).then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          throw new Error(`Error fetching twilio token for battle room ${battle.twilioRoomSid} with identity ${identity}: ${response.status} ${text}`);
        });
      }

      return response.json();
    }).then(({ token }) => {
      return TwilioVideo.connect(token, { name: battle.twilioRoomSid });
    }).then((room) => {
      disconnect = () => {
        console.log('DISCONNECT!');
        room.disconnect();
      };

      // ref: https://github.com/twilio/twilio-video-app-react/blob/c1036639699adfef779d00345db9543d9fa60cca/src/components/VideoProvider/useRoom/useRoom.tsx#L35
      window.addEventListener('beforeunload', disconnect);
      window.addEventListener('pagehide', disconnect);

      // Disable all tracks coming from the web viewer, this app should purely be an observer
      for (const [trackPublicationId, trackPublication] of [
        ...Array.from(room.localParticipant.videoTracks.entries()),
        ...Array.from(room.localParticipant.audioTracks.entries()),
      ]) {
        trackPublication.track.stop();
        console.log(`Stopped ${trackPublication.kind} track ${trackPublicationId}`);
      }

      connectingRef.current = false;

      setTwilioState({
        status: "CONNECTED",
        room,
      });
    }).catch(error => {
      connectingRef.current = false;
      console.error('Twilio error:', error);
      setTwilioState({ status: 'ERROR' });
    });

    return () => {
      if (disconnect) {
        disconnect();
        window.removeEventListener('beforeunload', disconnect);
        window.removeEventListener('pagehide', disconnect);

        disconnect = null;
      }
      setTwilioState({ status: 'READY' });
    };
  }, [isReady, baseUrl, battle.twilioRoomSid, identity]);

  if (battle.completedAt) {
    return (
      <div>
        Battle completed at {battle.completedAt}
      </div>
    );
  }

  switch (twilioState.status) {
    case "IDLE":
      return (
        <div style={{
          width: 480*2,
          height: 480,
          paddingTop: 4,
          paddingBottom: 4,
          border: `1px solid ${gray.gray10}`,
          borderRadius: 4,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <button onClick={() => setTwilioState({ status: "READY" })} style={{ padding: 8 }}>
            Click to view battle live
          </button>
        </div>
      );

    case "READY":
    case "LOADING":
      return (
        <div style={{
          width: 480*2,
          height: 480,
          paddingTop: 4,
          paddingBottom: 4,
          border: `1px solid ${gray.gray10}`,
          borderRadius: 4,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          Loading...
        </div>
      );

    case "ERROR":
      return (
        <div style={{
          width: 480*2,
          height: 480,
          paddingTop: 4,
          paddingBottom: 4,
          border: `1px solid ${gray.gray10}`,
          borderRadius: 4,

          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          Error connecting to twilio!
        </div>
      );

    case "CONNECTED":
      return (
        <div style={{
          width: 480*2,
          padding: 4,
          border: `1px solid ${gray.gray10}`,
          borderRadius: 4,

          display: 'flex',
          gap: 4,
          flexDirection: 'column',

          backgroundColor: gray.gray3,
        }}>
          <div style={{
            display: 'flex',
            gap: 4,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {battle.participants.sort((a, b) => (a.order || 0) > (b.order || 0) ? 1 : -1).map(participant => {
              const twilioParticipant = Array.from(
                twilioState.room.participants.entries()
              ).map(([_id, p]) => p).find((twilioParticipant) => {
                return twilioParticipant.identity === participant.id;
              });
              if (!twilioParticipant) {
                return (
                  <div>No twilio participant found!</div>
                );
              }

              if (!participant.twilioVideoTrackId) {
                return (
                  <div>No video track found</div>
                );
              }

              const videoTrackPublication = twilioParticipant.videoTracks.get(participant.twilioVideoTrackId);
              if (!videoTrackPublication) {
                return (
                  <div>No track found for {participant.twilioVideoTrackId}</div>
                );
              }
              if (!videoTrackPublication.track) {
                return (
                  <div>Publication for {participant.twilioVideoTrackId} is missing track</div>
                );
              }

              if (!participant.twilioAudioTrackId) {
                return (
                  <div>No video track found</div>
                );
              }

              const audioTrackPublication = twilioParticipant.audioTracks.get(participant.twilioAudioTrackId);
              if (!audioTrackPublication) {
                return null;
              }
              if (!audioTrackPublication.track) {
                return null;
              }

              return (
                <div>
                  <span style={{ fontSize: 10, color: gray.gray12 }}>
                    {`${participant.order}. ${participant.id} (user.name=${participant.user.name}, user.id=${participant.user.id})`}
                  </span>

                  <div style={{
                    border: `1px solid ${gray.gray12}`,
                    borderRadius: 4,
                    overflow: 'hidden',
                    outline: ["WARM_UP", "BATTLE"].includes(participant.currentState) ? `2px solid ${yellow.yellow9}` : undefined,
                    marginTop: 2,
                  }}>
                    <TwilioVideoTrackVideo
                      key={participant.id}
                      track={videoTrackPublication.track}
                      sizeInPx={470}
                    />
                  </div>

                  {audioEnabled ? (
                    <TwilioVideoTrackAudio
                      key={participant.id}
                      track={audioTrackPublication.track}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
          <button onClick={() => setAudioEnabled(n => !n)}>
            {audioEnabled ? 'Disable' : 'Enable'} Audio
          </button>
        </div>
      );
  }
};

const StateMachineEvent: React.FunctionComponent<{
  direction: "down" | "up",
  heightInPx: number,
  position: Date,
  color: string,
  xScale: ScaleTime<number, number>,
}> = ({ direction, heightInPx, position, color, xScale }) => {
  const positionInPx = xScale(position);

  const topSpacingInPx = heightInPx / 4;
  const lineHeightInPx = heightInPx / 2;

  const circleYInPx = topSpacingInPx + ((heightInPx - topSpacingInPx) / 2);

  return (
    <g transform={`translate(${positionInPx},0)`}>
      <line
        x1={0}
        y1={topSpacingInPx}
        x2={0}
        y2={topSpacingInPx + lineHeightInPx}
        strokeWidth={1}
        stroke={gray.gray12}
      />

      {direction === "down" ? (
        <g>
          <path
            transform={`translate(0,${topSpacingInPx + lineHeightInPx})`}
            d={`M-8,0 L8,0 L0,8 L-8,0 L0,0`}
            fill={color}
            strokeWidth={1}
            stroke={gray.gray12}
          />
          <circle
            cx={0}
            cy={topSpacingInPx}
            r={4}
            fill={color}
            strokeWidth={2}
            stroke={gray.gray12}
          />
        </g>
      ) : (
        <g>
          <path
            transform={`translate(0,${topSpacingInPx})`}
            d={`M-8,0 L8,0 L0,-8 L-8,0 L0,0`}
            fill={color}
            strokeWidth={1}
            stroke={gray.gray12}
          />
          <circle
            cx={0}
            cy={topSpacingInPx + lineHeightInPx}
            r={4}
            fill={color}
            strokeWidth={2}
            stroke={gray.gray12}
          />
        </g>
      )}
    </g>
  );
}

// The amount of time that a user must be offline before they automatically forfeit the battle
const BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS = 5.0;

const STATE_TO_COLOR = {
  "WARM_UP": blue.blue5,
  "BATTLE": blue.blue7,
  "TRANSITION_TO_NEXT_BATTLER": purple.purple3,
  "WAITING": yellow.yellow4,
  "TRANSITION_TO_SUMMARY": purple.purple7,
};
const STATE_TO_HATCHED = {
  "CREATED": true,
  "COIN_TOSS": false,
  "WARM_UP": false,
  "BATTLE": false,
  "TRANSITION_TO_NEXT_BATTLER": false,
  "WAITING": true,
  "TRANSITION_TO_SUMMARY": false,
};

// Given a series of checkins, generate a series of ranges of time that the system was in each state
function generateStateChanges(
  checkins: BattleWithParticipantsAndCheckinsAndEvents['participants'][0]['checkins'],
  battleCompletedAt: Date,
) {
  return checkins.sort((a, b) => a.checkedInAt.localeCompare(b.checkedInAt)).map((checkin, index) => {
    let nextCheckin = checkins[index+1];
    return {
      from: new Date(checkin.checkedInAt),
      to: nextCheckin ? new Date(nextCheckin.checkedInAt) : battleCompletedAt,
      state: checkin.state,
      context: checkin.context,
    };
  });
}

const BattleChart: React.FunctionComponent<{
  startDate: Date,
  endDate: Date,

  heightInPx?: number,

  battle: BattleWithParticipantsAndCheckinsAndEvents,
}> = ({
  startDate,
  endDate,
  heightInPx = 500,
  battle,
}) => {
  const ticks = useMemo(() => {
    return boundariesInRange(startDate, endDate);
  }, [startDate, endDate]);

  const margin = useMemo(
    () => ({ top: 8, right: 36, bottom: 24, left: 64 }),
    []
  );
  const [widthInPx, setWidthInPx] = useState(500);

  const [innerWidthInPx, innerHeightInPx] = useMemo(() => {
    return [
      widthInPx - margin.left - margin.right,
      heightInPx - margin.top - margin.bottom,
    ];
  }, [margin, widthInPx, heightInPx]);

  const trackHeightInPx = Math.min(innerHeightInPx / battle.participants.length, 192);

  const xScale = useMemo(() => {
    return scaleTime([startDate, endDate], [0, innerWidthInPx]);
  }, [startDate, endDate, innerWidthInPx]);

  const headerHeightInPx = 24;

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

          {battle.participants.sort((a, b) => (a.order || 0) > (b.order || 0) ? 1 : -1).map((participant, index) => {
            return (
              <Track
                yOffset={(trackHeightInPx+headerHeightInPx+4) * index}
                heightInPx={trackHeightInPx+headerHeightInPx}
                backgroundColor={index % 2 === 0 ? 'white' : 'rgba(0,0,0,0.05)'}
                xScale={xScale}
              >
                <image
                  href={participant.user.profileImageUrl || undefined}
                  x={0}
                  y={0}
                  width={headerHeightInPx}
                  height={headerHeightInPx}
                />
                <text
                  alignmentBaseline="middle"
                  fontFamily="monospace"
                  fill={gray.gray9}
                  transform={`translate(${headerHeightInPx+6},${headerHeightInPx/2})`}
                >
                  {`${participant.order}. ${participant.id} (user.name=${participant.user.name}, user.id=${participant.user.id})`}
                </text>

                <g transform={`translate(0,${headerHeightInPx})`}>
                  {generateStateChanges(participant.checkins, endDate).map(stateForRange => (
                    <Region
                      key={`${stateForRange.to.getTime()}`}
                      position={stateForRange.from}
                      lengthInSeconds={(stateForRange.to.getTime() - stateForRange.from.getTime()) / 1000}
                      heightInPx={trackHeightInPx}
                      backgroundColor={(STATE_TO_COLOR as any)[stateForRange.state] || gray.gray8}
                      hatched={(STATE_TO_HATCHED as any)[stateForRange.state] || false}
                      label={stateForRange.state}
                      labelClipThresholdPx={0}
                      xScale={xScale}
                    />
                  ))}

                  {participant.checkins.map(checkin => (
                    <Line
                      key={checkin.id}
                      position={parseISO(checkin.checkedInAt)}
                      heightInPx={trackHeightInPx}
                      color={red.red9}
                      dashed
                      xScale={xScale}
                    />
                  ))}

                  {participant.associatedWithBattleAt ? (
                    <Line
                      position={parseISO(participant.associatedWithBattleAt)}
                      heightInPx={trackHeightInPx}
                      color={pink.pink8}
                      xScale={xScale}
                    />
                  ) : null}

                  {participant.readyForBattleAt ? (
                    <Line
                      position={parseISO(participant.readyForBattleAt)}
                      heightInPx={trackHeightInPx}
                      color={blue.blue8}
                      xScale={xScale}
                    />
                  ) : null}
                </g>
              </Track>
            );
          })}

          {/* Render a line where the battle starts and finishes */}
          {battle.startedAt ? (
            <Line
              position={parseISO(battle.startedAt)}
              heightInPx={battle.participants.length * (trackHeightInPx+headerHeightInPx+4)}
              color={green.green8}
              label={`Battle Start (${
                (parseISO(battle.startedAt).getTime() - new Date(startDate).getTime()) / 1000
              }s, ${battle.startedAt})`}
              labelAlign="start"
              xScale={xScale}
            />
          ) : null}
          {battle.completedAt !== null ? (
            <Line
              position={parseISO(battle.completedAt)}
              heightInPx={battle.participants.length * (trackHeightInPx+headerHeightInPx+4)}
              color={green.green8}
              label={`Battle Complete (${
                (parseISO(battle.completedAt).getTime() - new Date(startDate).getTime()) / 1000
              }s, ${battle.completedAt})`}
              labelAlign="end"
              xScale={xScale}
            />
          ) : null}

          {battle.madeInactiveAt ? (
            <g>
              {battle.madeInactiveReason === "AUTO_FORFEIT_DUE_TO_INACTIVITY" ? (
                <Region
                  position={subSeconds(parseISO(battle.madeInactiveAt), BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS)}
                  lengthInSeconds={BATTLE_PARTICIPANT_DISCONNECT_BEFORE_FORFEIT_THRESHOLD_SECONDS}
                  heightInPx={battle.participants.length * (trackHeightInPx+headerHeightInPx+4)}
                  backgroundColor={colorAlpha(yellow.yellow8, 0.2)}
                  xScale={xScale}
                />
              ) : null}
              <Line
                position={parseISO(battle.madeInactiveAt)}
                heightInPx={battle.participants.length * (trackHeightInPx+headerHeightInPx+4)}
                color={yellow.yellow8}
                labelAlign="start"
                dashed
                xScale={xScale}
              />
            </g>
          ) : null}

          {battle.stateMachineEvents.map(event => (
            <StateMachineEvent
              direction={battle.participants.map(p => p.id).indexOf(event.triggeredByParticipantId) === 0 ? "down" : "up"}
              heightInPx={battle.participants.length * (trackHeightInPx+headerHeightInPx+4)}
              position={parseISO(event.createdAt)}
              color={green.green8}
              xScale={xScale}
            />
          ))}
        </g>
      </svg>
    </ChartAutoWidthResizer>
  );
};

function useQueryParams() {
  const [baseUrl, setBaseUrl] = useState<string | null>(null);

  const router = useRouter();
  const pathParams = useParams();

  const firstRunRef = useRef(true);
  const searchParamsRef = useRef(new URL(`http://example.com${router.asPath}`).searchParams);

  const run = useCallback(() => {
    if (!pathParams) {
      return;
    }
    let searchParamsRefChanged = false;

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

    if (searchParamsRefChanged) {
      const path = `${router.pathname.replace('[id]', `${pathParams.id}`)}?${searchParamsRef.current.toString()}`;
      if (firstRunRef.current) {
        router.replace(path);
      } else {
        router.push(path);
      }
    }

    firstRunRef.current = false;
  }, [pathParams, baseUrl]);

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
  };
}

export default function Index() {
  const pathParams = useParams();

  const { baseUrl } = useQueryParams();

  const [data, setData] = useState<
    | { status: "IDLE" }
    | { status: "LOADING" }
    | {
      status: "COMPLETE",
      battle: BattleWithParticipantsAndCheckinsAndEvents,
      battleRecording: BattleRecording | null,
    }
    | { status: "ERROR", error: any }
  >({ status: "IDLE" });

  useEffect(() => {
    if (!baseUrl) {
      return;
    }
    if (!pathParams) {
      return;
    }

    let timeoutId: NodeJS.Timeout | null = null;

    function run() {
      fetch(`${baseUrl}/v1/battles/${pathParams.id}`).then(response => {
        if (!response.ok) {
          return response.text().then(text => {
            throw new Error(`Error fetching battle with id ${pathParams.id}: ${response.status} ${text}`);
          });
        }

        return response.json();
      }).then((battle: BattleWithParticipantsAndCheckinsAndEvents) => {
        setData({ status: "COMPLETE", battle, battleRecording: null });

        if (battle.completedAt === null && battle.madeInactiveAt === null) {
          // Fetch again if the battle is still in progress
          timeoutId = setTimeout(run, 2000);
        } else {
          // Fetch battle recording data
          return fetch(`${baseUrl}/v1/battles/${pathParams.id}/recording`).then(response => {
            if (!response.ok) {
              return response.text().then(text => {
                throw new Error(`Error fetching battle recording with id ${pathParams.id}: ${response.status} ${text}`);
              });
            }

            return response.json();
          }).then(battleRecording => {
            setData({ status: "COMPLETE", battle, battleRecording });
          });
        }
      }).catch(error => {
        setData({ status: "ERROR", error });
      });
    }
    run();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setData({ status: "IDLE" })
    };
  }, [baseUrl]);

  switch (data.status) {
    case "IDLE":
    case "LOADING":
      return (
        <div>
          <p>Loading...</p>
        </div>
      );
    case "COMPLETE":
      const earliestParticipantCreatedAt = parseISO(data.battle.participants.map(p => p.createdAt).sort()[0]);
      const startDate = earliestParticipantCreatedAt;
      const endDate = parseISO(data.battle.madeInactiveAt || data.battle.completedAt || (new Date()).toISOString());

      return (
        <div style={{ position: 'relative', padding: 8, overflowX: 'auto' }}>
          {data.battle.completedAt === null && data.battle.madeInactiveAt === null ? (
            <div style={{
              position: 'absolute',
              top: 8,
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

          <a href={`https://console.twilio.com/us1/monitor/insights/video/video-rooms/${data.battle.twilioRoomSid}/participants/`}>
            Bandwidth
          </a>

          <ul>
            <li>Battle Id: <code>{data.battle.id}</code></li>
            <li>Battle twilio room sid: <code>{data.battle.twilioRoomSid}</code></li>
          </ul>

          <br />
          <br />
          <h2 style={{ marginBottom: 8 }}>Live Preview</h2>
          <TwilioVideoLiveView
            baseUrl={baseUrl}
            battle={data.battle}
          />

          <br />
          <br />
          <h2 style={{ marginBottom: 8 }}>Timeline</h2>
          <BattleChart
            startDate={startDate}
            endDate={endDate}

            battle={data.battle}
          />

          <br />
          <h5 style={{ marginBottom: 8 }}>Timeline Legend</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {[
              [green.green8, "Battle Started At / Completed At", false],
              [red.red9, "Check ins", true],
              [pink.pink8, "Participant Associated With Battle At", false],
              [blue.blue8, "Participant Ready For Battle At", false],
            ].map(([color, label, dashed]) => (
              <div key={label as string} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 16, height: 16, border: `2px ${dashed ? "dashed" : "solid"} ${color}`, borderRadius: 4 }} />
                <span style={{ fontSize: 12 }}>{label}</span>
              </div>
            ))}
          </div>

          <br />
          <br />
          <h2 style={{ marginBottom: 8 }}>State Machine Events</h2>
          <table style={{ borderSpacing: 8 }}>
            <thead>
              <tr>
                <th align="left">Created At</th>
                <th align="left">UUID (Client Generated)</th>
                <th align="left">Triggered By Participant</th>
                <th align="left">Payload</th>
              </tr>
            </thead>
            <tbody>
              {data.battle.stateMachineEvents.map(event => (
                <tr key={event.id}>
                  <td>{event.createdAt} ({(new Date(event.createdAt).getTime() - new Date(earliestParticipantCreatedAt).getTime()) / 1000}s)</td>
                  <td>{event.clientGeneratedUuid}</td>
                  <td>{event.triggeredByParticipantId}</td>
                  <td>
                    <pre>{JSON.stringify(event.payload)}</pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <br />
          <br />
          <h2 style={{ marginBottom: 8 }}>Recording</h2>
          <div>
            {data.battleRecording ? (
              <Fragment>
                Total comments: {data.battleRecording.battleCommentTotal}
                <div style={{ display: 'flex', flexDirection: 'row', gap: 8 }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    border: `1px solid ${gray.gray10}`,
                    padding: 4,
                    borderRadius: 4,
                  }}>
                    <span style={{ fontSize: 12 }}>Clean</span> 

                    <div style={{ display: 'flex', gap: 8 }}>
                      {data.battleRecording.battleCleanThumbnailUrls["256"] ? (
                        <img
                          src={data.battleRecording.battleCleanThumbnailUrls["256"]}
                          style={{ width: 128, height: 128*2 }}
                        />
                      ) : <div style={{ width: 128, height: 128*2 }}>No thumbnail</div>}
                      {data.battleRecording.battleCleanVideoUrl ? (
                        <video width={128} controls src={data.battleRecording.battleCleanVideoUrl}></video>
                      ) : <div style={{ width: 128, height: 128 }}>No video</div>}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    border: `1px solid ${gray.gray10}`,
                    padding: 4,
                    borderRadius: 4,
                  }}>
                    <span style={{ fontSize: 12 }}>Export</span> 

                    <div style={{ display: 'flex', gap: 8 }}>
                      {data.battleRecording.battleExportedThumbnailUrls["256"] ? (
                        <img
                          src={data.battleRecording.battleExportedThumbnailUrls["256"]}
                          style={{ width: 128*2, height: 128*2 }}
                        />
                      ) : <div style={{ width: 128*2, height: 128*2 }}>No thumbnail</div>}
                      {data.battleRecording.battleExportedVideoUrl ? (
                        <video width={128} controls src={data.battleRecording.battleExportedVideoUrl}></video>
                      ) : <div style={{ width: 128, height: 128*2 }}>No video</div>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {data.battleRecording.participants.map(p => (
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        border: `1px solid ${gray.gray10}`,
                        padding: 4,
                        borderRadius: 4,
                      }}>
                        <span style={{ fontSize: 12 }}>
                          {p.order}. {p.id} (user.name={p.user.name}, user.id={p.user.id})
                        </span>
                        <span style={{ fontSize: 8 }}>
                          Audio: {p.twilioAudioTrackId || <strong style={{ color: red.red8 }}>No track id!</strong>}
                          &nbsp;
                          {p.twilioAudioRecordingId || <strong style={{ color: yellow.yellow8 }}>No recording id!</strong>}
                        </span>
                        <span style={{ fontSize: 8 }}>
                          Video: {p.twilioVideoTrackId || <strong style={{ color: red.red8 }}>No track id!</strong>}
                          &nbsp;
                          {p.twilioVideoRecordingId || <strong style={{ color: yellow.yellow8 }}>No recording id!</strong>}
                        </span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {p.mediaThumbnailUrls["256"] ? (
                            <img key={p.id} src={p.mediaThumbnailUrls["256"]} style={{ width: 92, height: 92 }} />
                          ) : <div style={{ width: 92*2, height: 92*2 }}>No thumbnail</div>}
                          {p.mediaUrl ? (
                            <video width={92} height={92} controls src={p.mediaUrl}></video>
                          ) : <div style={{ width: 92, height: 92*2 }}>No video</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Fragment>
            ) : (
              <span>No recording</span>
            )}
          </div>
        </div>
      );
    case "ERROR":
      return (
        <div>
          <p>Error loading!</p>
        </div>
      );
  }
}
