// Presentation metadata for the amenity pins shown after a location is scored.
// Icons are Phosphor Icons (MIT, https://phosphoricons.com), regular weight,
// drawn with currentColor so the marker background can carry the category colour.
import coffeeIcon from '@phosphor-icons/core/assets/regular/coffee.svg?raw';
import restaurantIcon from '@phosphor-icons/core/assets/regular/fork-knife.svg?raw';
import groceryIcon from '@phosphor-icons/core/assets/regular/basket.svg?raw';
import trailIcon from '@phosphor-icons/core/assets/regular/person-simple-hike.svg?raw';
import parkIcon from '@phosphor-icons/core/assets/regular/tree.svg?raw';
import busIcon from '@phosphor-icons/core/assets/regular/bus.svg?raw';
import healthcareIcon from '@phosphor-icons/core/assets/regular/first-aid-kit.svg?raw';
import schoolIcon from '@phosphor-icons/core/assets/regular/graduation-cap.svg?raw';

export const POI_META = {
  coffee: {
    label: 'Coffee shop',
    color: '#e0a458',
    icon: coffeeIcon,
  },
  restaurant: {
    label: 'Dinner restaurant',
    color: '#f07167',
    icon: restaurantIcon,
  },
  grocery: {
    label: 'Grocery store',
    color: '#7bd389',
    icon: groceryIcon,
  },
  trail: {
    label: 'Trail access',
    color: '#b6e06b',
    icon: trailIcon,
  },
  park: {
    label: 'Park access',
    color: '#4db6ac',
    icon: parkIcon,
  },
  busStop: {
    label: 'Transit stop',
    color: '#63b3ed',
    icon: busIcon,
  },
  healthcare: {
    label: 'Healthcare',
    color: '#d183e8',
    icon: healthcareIcon,
  },
  schools: {
    label: 'School',
    color: '#ffd166',
    icon: schoolIcon,
  },
};

export function poiIconSvg(meta) {
  return meta.icon.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
}
