import type {ReactNode} from 'react';
import {NumberInput} from '@astryxdesign/core/NumberInput';
import {SegmentedControl, SegmentedControlItem} from '@astryxdesign/core/SegmentedControl';
import {Slider} from '@astryxdesign/core/Slider';
import {Text} from '@astryxdesign/core/Text';
import {ToggleButton, ToggleButtonGroup} from '@astryxdesign/core/ToggleButton';
import {VStack} from '@astryxdesign/core/VStack';
import {DRIZZLE_LIMIT_MM, T, formatCommuteHour, formatCommuteHours, type WeatherRules} from '../data/metrics';
import {COMMUTE_WEATHER, RAIN_INTENSITIES, type CommuteWeather, type MetricKey, type RainIntensity} from '../data/types';

export type HourlyStatus = 'idle' | 'loading' | 'ready' | 'error';

export function WeatherPreferences({label, summary, status, load, onReset, children}: {
  label: string;
  summary: string;
  status: HourlyStatus;
  load: () => void;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <details className="weather-preferences" onToggle={event => {
      if (event.currentTarget.open && status === 'idle') load();
    }}>
      <summary>
        {label}
        {summary && <span className="weather-preferences__summary">{summary}</span>}
      </summary>
      {status === 'loading' && <p role="status">Loading hourly weather…</p>}
      {status === 'error' && (
        <p role="status">
          Couldn’t load hourly weather. <button className="weather-preferences__action" type="button" onClick={load}>Try again</button>
        </p>
      )}
      {status === 'ready' && (
        <>
          <div className="weather-preferences__fields">{children}</div>
          {onReset && <button className="weather-preferences__action" type="button" onClick={onReset}>Reset to defaults</button>}
        </>
      )}
    </details>
  );
}

const degrees = (value: number) => `${value}°C`;
const windSpeed = (value: number) => `${value} km/h`;
const hours = (value: number) => `${value} ${value === 1 ? 'hour' : 'hours'}`;
const commuteWeatherTypes = Object.keys(COMMUTE_WEATHER) as CommuteWeather[];
const rainIntensities = Object.keys(RAIN_INTENSITIES) as RainIntensity[];
const labels: Record<MetricKey, string> = {
  comfort: 'Set your outdoor preferences',
  weekends: 'Set your weekend preferences',
  commute: 'Set your commute preferences',
  windRain: 'Set wind and rain preferences',
};
const ruleKeys = {comfort: 'comfort', weekends: 'weekend', commute: 'commute', windRain: 'windRain'} as const;

function WeatherTypeButtons<Value extends CommuteWeather>({label, groupLabel, options, value, onChange, fullRow}: {
  label: string;
  groupLabel: string;
  options: Value[];
  value: Value | null;
  onChange: (value: Value | null) => void;
  fullRow?: boolean;
}) {
  return (
    <div className={fullRow ? 'weather-type-options weather-type-options--full-row' : 'weather-type-options'}>
      <VStack gap={1}>
        <Text type="label">{label}</Text>
        <ToggleButtonGroup label={groupLabel} className="weather-type-buttons" value={value}
          onChange={selected => onChange(options.find(option => option === selected) ?? null)}>
          {options.map(option => (
            <ToggleButton key={option} value={option} label={COMMUTE_WEATHER[option].label} />
          ))}
        </ToggleButtonGroup>
        <Text type="supporting" size="sm">Select a type to filter. Select it again to clear.</Text>
      </VStack>
    </div>
  );
}

export function ReportPreferences({metric, rules, setRules, status, load}: {
  metric: MetricKey;
  rules: WeatherRules;
  setRules: (rules: WeatherRules) => void;
  status: HourlyStatus;
  load: () => void;
}) {
  const {comfort, weekend, commute, windRain} = rules;
  const key = ruleKeys[metric];
  const reset = rules[key] !== T[key] ? () => setRules({...rules, [key]: T[key]}) : undefined;
  const summary: string[] = [];
  let fields: ReactNode;
  switch (metric) {
    case 'comfort':
      if (comfort.minApparent !== T.comfort.minApparent || comfort.maxApparent !== T.comfort.maxApparent) {
        summary.push(`Feels like ${comfort.minApparent}–${degrees(comfort.maxApparent)}`);
      }
      if (comfort.maxWind !== T.comfort.maxWind) summary.push(`Wind below ${windSpeed(comfort.maxWind)}`);
      if (comfort.maxPrecip !== T.comfort.maxPrecip) summary.push('Light drizzle is OK');
      fields = (
        <>
          <Slider label="Feels-like temperature" value={[comfort.minApparent, comfort.maxApparent]}
            min={0} max={40} step={1} width="100%" valueDisplay="text" formatValue={degrees}
            onChange={([minApparent, maxApparent]: [number, number]) => setRules({...rules, comfort: {...comfort, minApparent, maxApparent}})} />
          <NumberInput label="Wind below" value={comfort.maxWind} min={5} max={50} step={1}
            units="km/h" width="min(100%, 11rem)" hasNumberSteppers isIntegerOnly isWheelEnabled={false}
            onChange={maxWind => setRules({...rules, comfort: {...comfort, maxWind}})} />
          <VStack gap={1}>
            <Text type="label">Rain</Text>
            <SegmentedControl label="Rain" value={comfort.maxPrecip === DRIZZLE_LIMIT_MM ? 'drizzle' : 'dry'}
              onChange={value => setRules({...rules, comfort: {
                ...comfort, maxPrecip: value === 'drizzle' ? DRIZZLE_LIMIT_MM : T.comfort.maxPrecip,
              }})}>
              <SegmentedControlItem value="dry" label="Dry only" />
              <SegmentedControlItem value="drizzle" label="Light drizzle is OK" />
            </SegmentedControl>
          </VStack>
        </>
      );
      break;
    case 'weekends':
      if (weekend.minApparent !== T.weekend.minApparent) summary.push(`Feels like ${degrees(weekend.minApparent)} or warmer`);
      if (weekend.minUsableHours !== T.weekend.minUsableHours) summary.push(`${hours(weekend.minUsableHours)} needed`);
      fields = (
        <>
          <Slider label="Coolest feels-like temperature" value={weekend.minApparent}
            min={0} max={30} step={1} width="100%" valueDisplay="text" formatValue={degrees}
            onChange={(minApparent: number) => setRules({...rules, weekend: {...weekend, minApparent}})} />
          <Slider label="Hours of good weather needed" value={weekend.minUsableHours}
            min={1} max={6} step={1} width="100%" valueDisplay="text" formatValue={hours}
            onChange={(minUsableHours: number) => setRules({...rules, weekend: {...weekend, minUsableHours}})} />
        </>
      );
      break;
    case 'commute':
      if (commute.am.some((hour, index) => hour !== T.commute.am[index])) summary.push(formatCommuteHours(commute.am));
      if (commute.pm.some((hour, index) => hour !== T.commute.pm[index])) summary.push(formatCommuteHours(commute.pm));
      if (commute.weather) summary.push(COMMUTE_WEATHER[commute.weather].label);
      fields = (
        <>
          <Slider label="Morning commute window" value={[...commute.am]}
            min={5} max={10} step={1} minStepsBetweenThumbs={1} width="100%" valueDisplay="text" formatValue={formatCommuteHour}
            onChange={(am: [number, number]) => setRules({...rules, commute: {...commute, am}})} />
          <Slider label="Evening commute window" value={[...commute.pm]}
            min={16} max={21} step={1} minStepsBetweenThumbs={1} width="100%" valueDisplay="text" formatValue={formatCommuteHour}
            onChange={(pm: [number, number]) => setRules({...rules, commute: {...commute, pm}})} />
          <WeatherTypeButtons label="Weather type" groupLabel="Commute weather type" options={commuteWeatherTypes} fullRow
            value={commute.weather} onChange={weather => setRules({...rules, commute: {...commute, weather}})} />
        </>
      );
      break;
    case 'windRain':
      if (windRain.minWind !== T.windRain.minWind) summary.push(`Wind at least ${windSpeed(windRain.minWind)}`);
      if (windRain.intensity) summary.push(RAIN_INTENSITIES[windRain.intensity].label);
      fields = (
        <>
          <Slider label="Count rain with winds of at least" value={windRain.minWind}
            min={5} max={50} step={1} width="100%" valueDisplay="text" formatValue={windSpeed}
            onChange={(minWind: number) => setRules({...rules, windRain: {...windRain, minWind}})} />
          <WeatherTypeButtons label="Rain intensity" groupLabel="Wind-driven rain intensity" options={rainIntensities}
            value={windRain.intensity} onChange={intensity => setRules({...rules, windRain: {...windRain, intensity}})} />
        </>
      );
      break;
  }
  return (
    <WeatherPreferences label={labels[metric]} summary={summary.join(' · ')} status={status} load={load} onReset={reset}>
      {fields}
    </WeatherPreferences>
  );
}
