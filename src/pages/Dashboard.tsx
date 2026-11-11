import {useDeferredValue, useEffect, useMemo, useState, type ReactNode} from 'react';
import {Layout, LayoutContent, LayoutHeader} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Grid} from '@astryxdesign/core/Grid';
import {Card} from '@astryxdesign/core/Card';
import {Section} from '@astryxdesign/core/Section';
import {Divider} from '@astryxdesign/core/Divider';
import {Heading} from '@astryxdesign/core/Heading';
import {Text} from '@astryxdesign/core/Text';
import {Icon} from '@astryxdesign/core/Icon';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Banner} from '@astryxdesign/core/Banner';
import {Collapsible} from '@astryxdesign/core/Collapsible';
import {Link} from '@astryxdesign/core/Link';
import {COMMUTE_METRIC_TITLE, WEEKEND_METRIC_TITLE, METRIC_DEFINITIONS, METRIC_KEYS, MONTHS, OUTDOOR_METRIC_TITLE, SEASONS, SEASON_MONTHS, WIND_RAIN_METRIC_TITLE, formatCommuteRate, formatWeatherDate, type CommuteWindow, type MetricKey, type MetricResult, type Season, type WeatherInsights} from '../data/types';
import {weatherSource} from '../data/source';
import {comparisonText, DeltaBadge, Figure, InsightList, METRIC_ICONS} from '../components/StatCard';
import {ComfortHeatmap, CommuteLines, MonthlyBars, OutdoorDayBars, SeasonMeter, WindRose, WindSpeedRose} from '../components/charts';
import {ReportPreferences, type HourlyStatus} from '../components/WeatherPreferences';
import {summarisePeriod, type HourlyWeather} from '../data/insights';
import {T, formatCommuteHours} from '../data/metrics';
import {loadPersonalisationHours} from '../data/personalisation';

type State = {status: 'loading'} | {status: 'error'; message: string} | {status: 'ready'; data: WeatherInsights};

const yearOf = (date: string) => date.slice(0, 4);

function periodLabel(period: WeatherInsights) {
  const year = yearOf(period.rangeStart);
  if (!period.rangeStart.endsWith('-01-01')) return `${year} (partial year)`;
  return period.rangeEnd.endsWith('-12-31') ? year : `${year} year to date`;
}

type YearOption = {value: string; label: string};
type SectionYears = Partial<Record<MetricKey, string>>;
const METRIC_SECTION_IDS: Record<MetricKey, string> = {
  comfort: 'comfortable-outdoor-hours',
  weekends: 'outdoor-friendly-weekend-afternoons',
  commute: 'wet-commutes',
  windRain: 'wind-driven-rain',
};

function coveredMonths(data: WeatherInsights, year: string) {
  const start = Number(data.rangeStart.slice(5, 7)) - 1;
  const end = Number(data.rangeEnd.slice(5, 7)) - 1;
  return MONTHS.map((_, i) => i).filter(i => year === 'all' || (i >= start && i <= end));
}

function FilterGroup<Value extends string>({label, name, value, options, onChange}: {
  label: string;
  name: string;
  value: Value;
  options: readonly {value: Value; label: string}[];
  onChange: (value: Value) => void;
}) {
  return (
    <fieldset className="weather-filter">
      <legend>{label}</legend>
      <div className="weather-filter__options">
        {options.map(option => (
          <label key={option.value}>
            <input type="radio" name={name} value={option.value} checked={value === option.value}
              onChange={() => onChange(option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function KpiTile({metric, baselineLabel, period}: {metric: MetricResult; baselineLabel: string; period?: string}) {
  const Glyph = METRIC_ICONS[metric.key];
  const definition = metric.definition ?? METRIC_DEFINITIONS[metric.key];
  const baseline = metric.key === 'commute' ? formatCommuteRate(metric.baseline, metric.unit)
    : `${Math.round(metric.baseline).toLocaleString('en-GB')} ${metric.unit === 'h' ? 'hours' : metric.unit}`;
  return (
    <Card padding={3}>
      <VStack gap={1.5}>
        <HStack gap={1.5} vAlign="center">
          <Icon icon={Glyph} size="sm" color="primary" />
          <Text type="label">{metric.title}</Text>
        </HStack>
        {period && <Text type="supporting" size="xsm">{period}</Text>}
        {definition && <Text as="p" type="supporting">{definition}</Text>}
        <Figure>{metric.display}</Figure>
        <HStack>
          <DeltaBadge metric={metric} baselineLabel={baselineLabel} />
        </HStack>
        <Text type="supporting">
          {baselineLabel}: {baseline}
        </Text>
        <Link className="weather-summary-jump" href={`#${METRIC_SECTION_IDS[metric.key]}`}
          label={`View details for ${metric.title}`} hasUnderline>
          View details
        </Link>
      </VStack>
    </Card>
  );
}

function MetricSection({
  metric,
  data,
  result = data.metrics[metric],
  filter,
  preferences,
  yearControl,
  showDates,
  children,
  aside,
  dailyChart,
}: {
  metric: MetricKey;
  data: WeatherInsights;
  result?: MetricResult;
  filter?: ReactNode;
  preferences?: ReactNode;
  yearControl?: ReactNode;
  showDates?: boolean;
  children: ReactNode;
  aside?: ReactNode;
  dailyChart?: ReactNode;
}) {
  const Glyph = METRIC_ICONS[metric];
  const definition = result.definition ?? METRIC_DEFINITIONS[metric];
  return (
    <section className="weather-metric-section" id={METRIC_SECTION_IDS[metric]}
      aria-label={data.metrics[metric].title} tabIndex={-1}>
      <VStack gap={3}>
        <Divider />
        <div className="weather-section-intro">
          <div className="weather-section-heading">
            <HStack gap={2} vAlign="center">
              <Icon icon={Glyph} size="md" color="primary" />
              <Heading level={2}>{data.metrics[metric].title}</Heading>
            </HStack>
          </div>
          {(showDates || definition) && (
            <div className="weather-section-meta">
              <VStack gap={1}>
                {showDates && <Text as="p" type="supporting">{formatWeatherDate(data.rangeStart)} to {formatWeatherDate(data.rangeEnd)}.</Text>}
                {definition && <Text as="p" type="supporting">{definition}</Text>}
              </VStack>
            </div>
          )}
          {yearControl}
          {preferences}
        </div>
        {filter}
        <div className="wtm-report-result" aria-live={filter || preferences || yearControl ? 'polite' : undefined}>
          <Text as="p"><strong>{result.display}</strong> here. {comparisonText(result, data.baselineLabel)}.</Text>
          <InsightList items={result.insights} />
        </div>
        <div className={`weather-charts weather-charts--${metric}${dailyChart ? ' weather-charts--with-daily' : ''}`}>
          {dailyChart && <div className="weather-outdoor-days-section">{dailyChart}</div>}
          <div className="weather-charts__primary">{children}</div>
          {aside && (
            <div className="weather-charts__monthly">
              <VStack gap={1}>
                <Text type="label">By month</Text>
                {aside}
              </VStack>
            </div>
          )}
        </div>
      </VStack>
    </section>
  );
}

export function Dashboard({propertyId}: {propertyId: string | null}) {
  const [state, setState] = useState<State>({status: 'loading'});
  useEffect(() => {
    weatherSource
      .load(propertyId ?? '')
      .then(data => setState({status: 'ready', data}))
      .catch(err => setState({status: 'error', message: String(err?.message ?? err)}));
  }, [propertyId]);

  return (
    <Layout
      height="auto"
      contentWidth={1040}
      padding={4}
      header={
        <LayoutHeader hasDivider>
          <VStack gap={1}>
            <Link href={`/demo_page.html${location.search}`}>
              ← Back to property
            </Link>
            <div className="weather-report-branding">
              <VStack gap={1}>
                <img className="weather-report-rightmove" src={`${import.meta.env.BASE_URL}brand/rightmove-logo.svg`}
                  alt="Rightmove" width={142} height={30} />
                {state.status === 'ready' && <Text type="label">{state.data.propertyLabel}</Text>}
                <Text type="supporting">Past weather near this home</Text>
              </VStack>
              <div className="weather-report-title">
                <img className="weather-report-logo" src={`${import.meta.env.BASE_URL}brand/weather-to-move-logo.png`}
                  alt="" width={64} height={64} />
                <Heading level={1} className="weather-report-heading">Weather to Move</Heading>
              </div>
            </div>
          </VStack>
        </LayoutHeader>
      }
      content={
        <LayoutContent>
          {state.status === 'loading' && (
            <VStack gap={4}>
              <Grid columns={{minWidth: 220, max: 4}} gap={3}>
                {METRIC_KEYS.map((k, i) => (
                  <Skeleton key={k} height={140} index={i} />
                ))}
              </Grid>
              <Skeleton height={320} index={4} />
            </VStack>
          )}
          {state.status === 'error' && <Banner status="error" title="Couldn't load weather data" description={state.message} />}
          {state.status === 'ready' && <WeatherBreakdown key={state.data.propertyId} data={state.data} />}
        </LayoutContent>
      }
    />
  );
}

function WeatherBreakdown({data}: {data: WeatherInsights}) {
  const [sectionYears, setSectionYears] = useState<SectionYears>({});
  const periods = data.byYear ?? [];
  const yearOptions = [{value: 'all', label: 'All years'}, ...periods.map(period => ({
    value: yearOf(period.rangeStart), label: periodLabel(period),
  }))];
  const changeSectionYear = (metric: MetricKey, value: string) => setSectionYears(previous => ({
    ...previous,
    [metric]: value === 'all' ? undefined : value,
  }));
  return (
    <VStack gap={4}>
      <p className="weather-period__coverage">
        Weather data from {formatWeatherDate(data.rangeStart)} to {formatWeatherDate(data.rangeEnd)}. Compared with {data.baselineLabel}.
        {periods.length > 0 && ' All years shows average counts per year.'}
      </p>
      <Ready fullPeriod={data} sectionYears={sectionYears} yearOptions={yearOptions} onSectionYearChange={changeSectionYear} />
    </VStack>
  );
}

function Ready({fullPeriod, sectionYears, yearOptions, onSectionYearChange}: {
  fullPeriod: WeatherInsights;
  sectionYears: SectionYears;
  yearOptions: YearOption[];
  onSectionYearChange: (metric: MetricKey, year: string) => void;
}) {
  const [seasonChoice, setSeason] = useState<Season | 'all'>('all');
  const [commuteWindow, setCommuteWindow] = useState<CommuteWindow | 'all'>('all');
  const [rules, setRules] = useState(T);
  const [hourly, setHourly] = useState<HourlyWeather>();
  const [status, setStatus] = useState<HourlyStatus>('idle');
  const activeRules = useDeferredValue(rules);
  const isPersonalised = activeRules.comfort !== T.comfort || activeRules.weekend !== T.weekend ||
    activeRules.commute !== T.commute || activeRules.windRain !== T.windRain;

  const load = () => {
    if (status !== 'idle' && status !== 'error') return;
    setStatus('loading');
    loadPersonalisationHours(fullPeriod).then(hours => {
      setHourly(hours);
      setStatus('ready');
    }).catch(() => setStatus('error'));
  };
  const reports = useMemo(() => {
    const selectedYears = new Set(METRIC_KEYS.map(metric => sectionYears[metric] ?? 'all'));
    const reportsByYear = new Map<string, WeatherInsights>();
    for (const selectedYear of selectedYears) {
      const period = fullPeriod.byYear?.find(item => yearOf(item.rangeStart) === selectedYear) ?? fullPeriod;
      if (!hourly || !isPersonalised) {
        reportsByYear.set(selectedYear, period);
        continue;
      }
      const annualised = selectedYear === 'all';
      const hours = annualised ? hourly : {
        property: hourly.property.filter(hour => hour.year === Number(selectedYear)),
        baseline: hourly.baseline.filter(hour => hour.year === Number(selectedYear)),
      };
      reportsByYear.set(selectedYear, summarisePeriod(period, hours, annualised, activeRules));
    }
    return reportsByYear;
  }, [fullPeriod, hourly, isPersonalised, activeRules, sectionYears]);
  const yearFor = (metric: MetricKey) => sectionYears[metric] ?? 'all';
  const reportFor = (metric: MetricKey) => reports.get(yearFor(metric)) ?? fullPeriod;
  const outdoorData = reportFor('comfort');
  const outdoorDays = outdoorData.detail.comfort.dailyHours;
  const outdoorAnnualised = yearFor('comfort') === 'all';
  const gardenData = reportFor('weekends');
  const commuteData = reportFor('commute');
  const windData = reportFor('windRain');
  const windDetail = windData.detail.windRain;
  const yearControl = (metric: MetricKey, title: string) => yearOptions.length > 1 && (
    <label className="weather-section-year-field">
      <span>Year</span>
      <select className="weather-section-year" aria-label={`Year for ${title}`} value={yearFor(metric)}
        onChange={event => onSectionYearChange(metric, event.currentTarget.value)}>
        {yearOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
  const preferences = (metric: MetricKey) => fullPeriod.source !== 'sample' && (
    <ReportPreferences metric={metric} rules={rules} setRules={setRules} status={status} load={load} />
  );
  const filteredWeekends = seasonChoice === 'all' ? undefined : gardenData.filters?.weekends[seasonChoice];
  const season = filteredWeekends ? seasonChoice : 'all';
  const filteredCommute = commuteWindow === 'all' ? undefined : commuteData.filters?.commute[commuteWindow];
  const metrics = {
    comfort: outdoorData.metrics.comfort,
    weekends: filteredWeekends ?? gardenData.metrics.weekends,
    commute: filteredCommute ?? commuteData.metrics.commute,
    windRain: windData.metrics.windRain,
  };
  const {comfort, weekends, commute, windRain} = metrics;
  const outdoorMonths = coveredMonths(outdoorData, yearFor('comfort'));
  const weekendMonths = coveredMonths(gardenData, yearFor('weekends'))
    .filter(month => season === 'all' || SEASON_MONTHS[season].includes(month));
  const commuteMonths = coveredMonths(commuteData, yearFor('commute'));
  const windMonths = coveredMonths(windData, yearFor('windRain'));
  const weekendSeasons = gardenData.detail.weekends.bySeason.filter(s => s.total > 0 && (season === 'all' || s.season === season));
  return (
    <VStack gap={6}>
      {fullPeriod.source === 'sample' && <Text type="supporting">Sample report. Preferences are available with hourly weather data.</Text>}
      <Grid columns={{minWidth: 220, max: 4}} gap={3}>
        {METRIC_KEYS.map(k => (
          <KpiTile key={k} metric={metrics[k]} baselineLabel={fullPeriod.baselineLabel}
            period={sectionYears[k] && yearOptions.find(option => option.value === sectionYears[k])?.label} />
        ))}
      </Grid>

      <MetricSection
        metric="comfort"
        data={outdoorData}
        yearControl={yearControl('comfort', OUTDOOR_METRIC_TITLE)}
        showDates={Boolean(sectionYears.comfort)}
        preferences={preferences('comfort')}
        dailyChart={outdoorDays && (
          <VStack gap={1}>
            <Text type="label">Outdoor time per day</Text>
            <Text type="supporting">
              {outdoorAnnualised ? 'Average days per year.' : 'Days in this period.'} Usable hours can be spread across the day.
            </Text>
            <OutdoorDayBars days={outdoorDays} baselineLabel={outdoorData.baselineLabel} annualised={outdoorAnnualised} />
          </VStack>
        )}
        aside={
          <MonthlyBars
            months={outdoorMonths}
            monthly={comfort.monthly}
            baseline={comfort.baselineMonthly}
            unit="h"
            propertyLabel="This home"
            baselineLabel={outdoorData.baselineLabel}
            homeFirst
          />
        }>
        <VStack gap={1}>
          <Text type="label">Best times for garden and balcony</Text>
          <Text type="supporting">
            Darker squares mean good weather was more common.
          </Text>
          <ComfortHeatmap heat={outdoorData.detail.comfort.heat} months={outdoorMonths} />
        </VStack>
      </MetricSection>

      <MetricSection
        metric="weekends"
        data={gardenData}
        yearControl={yearControl('weekends', WEEKEND_METRIC_TITLE)}
        showDates={Boolean(sectionYears.weekends)}
        result={weekends}
        preferences={preferences('weekends')}
        filter={gardenData.filters && (
          <FilterGroup<Season | 'all'> label="Season" name="weekend-season" value={season} onChange={setSeason}
            options={[
              {value: 'all', label: 'All seasons'},
              ...SEASONS.filter(item => gardenData.filters?.weekends[item]).map(item => ({value: item, label: item})),
            ]} />
        )}
        aside={
          <MonthlyBars
            months={weekendMonths}
            monthly={weekends.monthly}
            baseline={weekends.baselineMonthly}
            unit="afternoons"
            propertyLabel="This address"
            baselineLabel={gardenData.baselineLabel}
          />
        }>
        <VStack gap={3}>
          <Text type="label">{season === 'all' ? 'By season' : 'Outdoor-friendly afternoons'}{yearFor('weekends') === 'all' && ' (average per year)'}</Text>
          {weekendSeasons.map(s => (
            <VStack key={s.season} gap={1}>
              <HStack hAlign="between">
                <Text>{s.season}</Text>
                <Text hasTabularNumbers>
                  {s.usable} / {s.total}
                </Text>
              </HStack>
              <SeasonMeter usable={s.usable} total={s.total} />
            </VStack>
          ))}
          {season === 'all' && (
            <Text type="supporting">
              Longest stretch without a outdoor-friendly weekend afternoon: {gardenData.detail.weekends.longestUnusableStreak} weekends.
            </Text>
          )}
        </VStack>
      </MetricSection>

      <MetricSection
        metric="commute"
        data={commuteData}
        yearControl={yearControl('commute', COMMUTE_METRIC_TITLE)}
        showDates={Boolean(sectionYears.commute)}
        result={commute}
        preferences={preferences('commute')}
        filter={commuteData.filters && (
          <FilterGroup<CommuteWindow | 'all'> label="Commute time" name="commute-time" value={commuteWindow} onChange={setCommuteWindow}
            options={[
              {value: 'all', label: 'All commutes'},
              {value: 'am', label: 'Morning'},
              {value: 'pm', label: 'Evening'},
            ]} />
        )}
        aside={
          <MonthlyBars
            months={commuteMonths}
            monthly={commute.monthly}
            baseline={commute.baselineMonthly}
            unit={commute.unit}
            propertyLabel="This address"
            baselineLabel={commuteData.baselineLabel}
          />
        }>
        <VStack gap={1}>
          <Text type="label">{filteredCommute ? commute.title : 'Morning vs evening commutes'}</Text>
          <CommuteLines am={commuteData.detail.commute.amWetShare} pm={commuteData.detail.commute.pmWetShare} months={commuteMonths} unit={commute.unit}
            morningLabel={`Morning (${formatCommuteHours(activeRules.commute.am)})`}
            eveningLabel={`Evening (${formatCommuteHours(activeRules.commute.pm)})`}
            window={filteredCommute && commuteWindow !== 'all' ? commuteWindow : undefined} />
        </VStack>
      </MetricSection>

      <MetricSection
        metric="windRain"
        data={windData}
        yearControl={yearControl('windRain', WIND_RAIN_METRIC_TITLE)}
        showDates={Boolean(sectionYears.windRain)}
        preferences={preferences('windRain')}
        aside={
          <MonthlyBars
            months={windMonths}
            monthly={windRain.monthly}
            baseline={windRain.baselineMonthly}
            unit="h"
            propertyLabel="This address"
            baselineLabel={windData.baselineLabel}
          />
        }>
        <div className="weather-wind-compasses">
          <VStack gap={1}>
            <Text type="label">Wind-driven rain hours by direction</Text>
            <WindRose rose={windDetail.rose} annualised={yearFor('windRain') === 'all'} />
            <Text type="supporting">
              {windDetail.severeHoursPerYear} hours{yearFor('windRain') === 'all' && ' a year'} with wind-driven rain and gusts of 60 km/h or more.
            </Text>
          </VStack>
          {windDetail.meanSpeedByDirection && (
            <VStack gap={1}>
              <Text type="label">Average wind speed by direction (km/h)</Text>
              <WindSpeedRose speeds={windDetail.meanSpeedByDirection} />
              <Text type="supporting">
                {windRain.value > 0
                  ? 'Averages use the hours that match your filters. Blank directions had no matching hours.'
                  : 'No hours matched your filters.'}
              </Text>
            </VStack>
          )}
        </div>
      </MetricSection>

      <Section variant="muted" padding={4}>
        <Collapsible trigger={<Text type="label">How we count the weather by default</Text>} defaultIsOpen={false}>
          <VStack gap={2}>
            <Text as="p">
              <strong>{OUTDOOR_METRIC_TITLE}.</strong> Between 8 am and 8 pm, it felt like 14–26°C, with less than
              0.1 mm of precipitation and winds under 25 km/h.
            </Text>
            <Text as="p">
              <strong>{WEEKEND_METRIC_TITLE}.</strong> At least four hours from noon to 6 pm on a Saturday or Sunday
              felt like 12°C or warmer, with less than 0.1 mm of precipitation and winds under 25 km/h.
            </Text>
            <Text as="p">
              <strong>{COMMUTE_METRIC_TITLE}.</strong> At least 0.2 mm of precipitation in any hour from 7–9 am or
              5–7 pm on weekdays. The figures describe weather near the home.
            </Text>
            <Text as="p">
              <strong>{WIND_RAIN_METRIC_TITLE}.</strong> An hour with at least 0.5 mm of precipitation and winds of
              20 km/h or more.
            </Text>
            <Text type="supporting">
              Open-Meteo’s historical IFS model estimates weather near the home. We use the same dates and rules for a point in central London.
            </Text>
          </VStack>
        </Collapsible>
      </Section>
    </VStack>
  );
}
