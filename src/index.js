import _ from 'lodash';
import './index.scss';

import train_lines from '../train_lines';
import train_line_svg from '../train_line_svg';

let corrections = null;
let geojson_lines = null;
let all_lines = null;

let load_train_line_svg = (company_name, line_name, filter_line=null) => {
  let correction = corrections[company_name] && corrections[company_name][line_name];
  let svg = train_line_svg(geojson_lines, company_name, line_name, 640, correction);
  let viewer = document.querySelector('#svg-viewer');
  viewer.innerHTML = svg;


  for (var p of document.querySelectorAll('g.segment')) {
    p.addEventListener('mouseover', (e) => {
      e.target.setAttribute('stroke-width', '4');
      e.target.setAttribute('stroke', 'red');

    });
    p.addEventListener('mouseout', (e) => {
      e.target.removeAttribute('stroke-width');
      e.target.removeAttribute('stroke');
    });
  }
};

let create_controls = () => {
  let companies = Object.keys(all_lines);
  var controls = document.querySelector('#controls');
  for (var company of companies) {
    var d = document.createElement('a');
    d.setAttribute('class', 'company');
    d.setAttribute('href', '#');
    d.setAttribute('data-company', company);
    d.appendChild(document.createTextNode(company));
    d.addEventListener('click', (e) => {
      e.preventDefault();
      let element = e.target;
      let company_name = element.getAttribute('data-company');
      load_train_line_svg(company_name, null);
      return true;
    });
    controls.appendChild(d);
    var lines = Object.keys(all_lines[company]);

    for (var line of lines) {
      var l = document.createElement('a');
      l.setAttribute('class', 'line');
      l.setAttribute('href', '#');
      l.setAttribute('data-line', line);
      l.setAttribute('data-company', company);
      l.appendChild(document.createTextNode(line));
      l.addEventListener('click', (e) =>{
        e.preventDefault();
        let element = e.target;
        let line_name = element.getAttribute('data-line');
        let company_name = element.getAttribute('data-company');
        load_train_line_svg(company_name, line_name);
        return true;
      });
      controls.appendChild(l);
    }
  }
};

let main = () => {
  fetch('/config/train_line_corrects.json').then(r => r.json()).then((json) => {
    corrections = json;
    fetch('/data/N02-18_GML/N02-18_RailroadSection.geojson')
      .then((response) => {
        return response.json();
      })
      .then((json) => {
        geojson_lines = json;
        all_lines = train_lines(json);
        create_controls();
        load_train_line_svg('東日本旅客鉄道', '山手線');
      });
  });
};

main();

// let createPlacesheet = () => {
//   const root = document.querySelector('#mobile-frame');
//   let header = document.createElement('div');
//   header.setAttribute('class', 'ps-header');
//   root.appendChild(header);

//   let headerCaption = document.createElement('div');
//   headerCaption.setAttribute('class', 'ps-header-caption');
//   {
//     let title = document.createElement('div');
//     title.setAttribute('class', 'ps-header-caption-title');
//     title.appendChild(document.createTextNode("東京茶寮"));
//     headerCaption.appendChild(title);
//   }
//   {
//     let ugcLine = document.createElement('div');
//     ugcLine.setAttribute('class', 'ps-header-caption-ugc');
//     ugcLine.appendChild(document.createTextNode("4.4 ✭✭✭✭✩ (83)"));
//     headerCaption.appendChild(ugcLine);    
//   }
//   {
//     let subtitle = document.createElement('div');
//     subtitle.setAttribute('class', 'ps-header-caption-subtitle');
//     subtitle.appendChild(document.createTextNode("茶葉販売店.お手頃"));
//     headerCaption.appendChild(subtitle);        
//   }
//   {
//     let subtitle = document.createElement('div');
//     subtitle.setAttribute('class', 'ps-header-caption-subtitle');
//     subtitle.appendChild(document.createTextNode("営業時間外 13:00 木営業開始"));
//     headerCaption.appendChild(subtitle);        
//   }
//   root.append(headerCaption);


// };

// createPlacesheet();
