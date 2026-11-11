import type {ComponentType, SVGProps} from 'react';
import {Card} from '@astryxdesign/core/Card';
import {VStack} from '@astryxdesign/core/VStack';
import {HStack} from '@astryxdesign/core/HStack';
import {Text} from '@astryxdesign/core/Text';
import {Badge} from '@astryxdesign/core/Badge';
import {Icon} from '@astryxdesign/core/Icon';
import {Sun, Trees, CloudRain, Wind} from 'lucide-react';
import {METRIC_DEFINITIONS, type MetricKey, type MetricResult} from '../data/types';
import {MiniBars} from './MiniBars';
import '../styles/insights.css';

export const METRIC_ICONS: Record<MetricKey, ComponentType<SVGProps<SVGSVGElement>>> = {
  comfort: Sun,
  weekends: Trees,
  commute: CloudRain,
  windRain: Wind,
};

export function comparisonText(metric: MetricResult, baselineLabel: string) {
  const scale = metric.key === 'commute' && metric.unit !== '% wet' ? 10 : 1;
  const diff = (Math.round(metric.value * scale) - Math.round(metric.baseline * scale)) / scale;
  if (!diff) return `Similar to ${baselineLabel}`;
  const count = Math.abs(diff);
  const direction = diff > 0 ? 'more' : 'fewer';
  if (metric.key === 'commute') return `${count} ${direction} per 100 commutes than ${baselineLabel}`;
  const unit = metric.key === 'weekends' ? 'afternoon' : 'hour';
  return `${count.toLocaleString('en-GB')} ${direction} ${unit}${count === 1 ? '' : 's'} than ${baselineLabel}`;
}

export function DeltaBadge({metric, baselineLabel}: {metric: MetricResult; baselineLabel: string}) {
  return <Badge variant="gray" label={comparisonText(metric, baselineLabel)} />;
}

export function InsightList({items}: {items: string[]}) {
  if (!items.length) return null;
  return (
    <ul className="wtm-insights">
      {items.map(item => <li key={item}>{item}</li>)}
    </ul>
  );
}

/** Headline figure in Rightmove's price style: 24/32 Effra-Medium. */
export function Figure({children}: {children: string}) {
  return (
    <Text type="display-3" weight="medium" hasTabularNumbers>
      {children}
    </Text>
  );
}

export function StatCard({metric, baselineLabel}: {metric: MetricResult; baselineLabel: string}) {
  const IconGlyph = METRIC_ICONS[metric.key];
  const definition = METRIC_DEFINITIONS[metric.key];
  return (
    <Card padding={3}>
      <VStack gap={2}>
        <HStack gap={1.5} vAlign="center">
          <Icon icon={IconGlyph} size="sm" color="primary" />
          <Text type="label">{metric.title}</Text>
        </HStack>
        {definition && <Text type="supporting" as="p">{definition}</Text>}
        <Figure>{metric.display}</Figure>
        <HStack>
          <DeltaBadge metric={metric} baselineLabel={baselineLabel} />
        </HStack>
        <InsightList items={metric.insights} />
        <MiniBars values={metric.monthly} baseline={metric.baselineMonthly} unit={metric.unit} baselineLabel={baselineLabel} />
      </VStack>
    </Card>
  );
}
