import {useEffect, useState} from 'react';
import {Drawer, DrawerHeader} from '@astryxdesign/core/Drawer';
import {Layout, LayoutContent, LayoutFooter} from '@astryxdesign/core/Layout';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Button} from '@astryxdesign/core/Button';
import {Text} from '@astryxdesign/core/Text';
import {Skeleton} from '@astryxdesign/core/Skeleton';
import {Banner} from '@astryxdesign/core/Banner';
import {Icon} from '@astryxdesign/core/Icon';
import {ArrowRight} from 'lucide-react';
import {METRIC_KEYS, formatWeatherDate, type WeatherInsights} from '../data/types';
import {weatherSource} from '../data/source';
import {StatCard} from './StatCard';

interface Props {
  propertyId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardUrl: string;
}

type State = {status: 'loading'} | {status: 'error'; message: string} | {status: 'ready'; data: WeatherInsights};
const PANEL_YEAR = 2025;

export function WeatherPanel({propertyId, isOpen, onOpenChange, dashboardUrl}: Props) {
  const [state, setState] = useState<State>({status: 'loading'});
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setState({status: 'loading'});
    weatherSource
      .load(propertyId)
      .then(data => {
        if (cancelled) return;
        const yearlyData = [data, ...(data.byYear ?? [])].find(period =>
          period.rangeStart === `${PANEL_YEAR}-01-01` && period.rangeEnd === `${PANEL_YEAR}-12-31`,
        );
        if (!yearlyData) throw new Error(`Full-year weather data for ${PANEL_YEAR} is unavailable for this home.`);
        setState({status: 'ready', data: yearlyData});
      })
      .catch(err => !cancelled && setState({status: 'error', message: String(err?.message ?? err)}));
    return () => {
      cancelled = true;
    };
  }, [propertyId, isOpen, attempt]);

  const subtitle =
    state.status === 'ready'
      ? `${state.data.propertyLabel} · ${PANEL_YEAR}`
      : 'Past weather near this home';

  return (
    <Drawer
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      label="Weather insights for this property"
      width={440}
      experimental={{isFullWidthOnMobile: true}}>
      <Layout
        header={
          <DrawerHeader
            title="Weather to Move"
            subtitle={subtitle}
            startContent={
              <img className="wtm-drawer-logo" src={`${import.meta.env.BASE_URL}brand/weather-to-move-logo.png`}
                alt="" width={40} height={40} />
            }
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {state.status === 'loading' && (
              <VStack gap={3}>
                {METRIC_KEYS.map((k, i) => (
                  <Skeleton key={k} height={150} index={i} />
                ))}
              </VStack>
            )}
            {state.status === 'error' && (
              <Banner status="error" title="Couldn't load weather data" description={state.message} />
            )}
            {state.status === 'ready' && (
              <VStack gap={3}>
                <Text type="supporting" size="sm">
                  Jan–Dec. Teal bars show this area. Dark lines show {state.data.baselineLabel}.
                </Text>
                {METRIC_KEYS.map(k => (
                  <StatCard key={k} metric={state.data.metrics[k]} baselineLabel={state.data.baselineLabel} />
                ))}
                <Text type="supporting" size="sm">
                  Open-Meteo, {formatWeatherDate(state.data.rangeStart)} to {formatWeatherDate(state.data.rangeEnd)}.
                </Text>
              </VStack>
            )}
            {state.status === 'error' && (
              <HStack gap={2} hAlign="end">
                <Button label="Retry" variant="secondary" onClick={() => setAttempt(a => a + 1)} />
              </HStack>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <Button
              label="See detailed report"
              className="wtm-dashboard-link"
              variant="primary"
              width="100%"
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              endContent={<Icon icon={ArrowRight} color="primary" />}
            />
          </LayoutFooter>
        }
      />
    </Drawer>
  );
}
