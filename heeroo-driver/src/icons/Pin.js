import * as React from 'react';
import { SvgXml } from 'react-native-svg';
import { colors} from '../common/theme';

const xml =(color)=> `
<?xml version="1.0" encoding="UTF-8"?>
<svg width="21px" height="28px" viewBox="0 0 21 28" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <title>Pin icon</title>
    <g id="Cabbo" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="24-Search-4" transform="translate(-294.000000, -450.000000)">
            <g id="Pin-icon" transform="translate(294.000000, 450.000000)">
                <path d="M10.1612903,0 C4.55733871,0 0,4.50145161 0,10.1621371 C0,16.0895565 5.08149194,22.1533065 8.78612903,26.415121 C8.79967742,26.4320565 9.3941129,27.0967742 10.1291129,27.0967742 C10.1308065,27.0967742 10.1909274,27.0967742 10.1943145,27.0967742 C10.9284677,27.0967742 11.52375,26.4320565 11.5372984,26.415121 C15.243629,22.1533065 20.3242742,16.0904032 20.3242742,10.1621371 C20.3242742,4.50145161 15.7660887,0 10.1612903,0 Z" id="Shape" fill="${color?color:colors.PRIMARY}"></path>
                <path d="M10.1629839,5.71233871 C12.4983871,5.71233871 14.3968548,7.61080645 14.3968548,9.94620968 C14.3968548,12.2816129 12.4983871,14.1800806 10.1629839,14.1800806 C7.82758065,14.1800806 5.9291129,12.2816129 5.9291129,9.94620968 C5.9291129,7.61080645 7.82758065,5.71233871 10.1629839,5.71233871 Z" id="Shape" fill="#E2E6EC"></path>
            </g>
        </g>
    </g>
</svg>
`;

export default (props) => <SvgXml  xml={xml(props.color)} {...props} />;

