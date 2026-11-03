import { fetchJSON, renderProjects } from '../global.js';
const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function renderPieChart(projectsGiven) {
  const rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );
  const data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });
  const sliceGenerator = d3.pie().value((d) => d.value);
  const arcData = sliceGenerator(data);
  const arcs = arcData.map((d) => arcGenerator(d));
  let newSVG = d3.select('#projects-plot');
  const legend = d3.select('.legend');
  let selectedIndex = -1;

  newSVG.selectAll('path').remove();
  legend.selectAll('li').remove();

  arcs.forEach((arc, i) => {
    newSVG
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(i))
      .on('click', () => {
        selectedIndex = selectedIndex === i ? -1 : i;

        newSVG
          .selectAll('path')
          .classed('selected', (_, idx) => idx === selectedIndex);
        legend
          .selectAll('li')
          .classed('selected', (_, idx) => idx === selectedIndex);

        if (selectedIndex === -1) {
          renderProjects(projectsGiven, projectsContainer, 'h2');
        } else {
          const selectedYear = data[selectedIndex].label;
          const filteredProjects = projectsGiven.filter(
            (project) => project.year === selectedYear,
          );
          renderProjects(filteredProjects, projectsContainer, 'h2');
        }
      });
  });

  data.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`);
  });
}

renderPieChart(projects);

// search bar
const searchInput = document.querySelector('.searchBar');
searchInput.addEventListener('change', (event) => {
  const query = event.target.value.toLowerCase();
  const filteredProjects = projects.filter((project) => {
    const values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query);
  });
  renderProjects(filteredProjects, projectsContainer, 'h2');
  renderPieChart(filteredProjects);
});
