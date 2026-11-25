import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line), // or just +row.line
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));


  return data;
}

let commitProgress = 100;
let timeScale;
let commitMaxTime;

function onTimeSliderChange() {
  const slider = document.querySelector('#commit-progress');
  commitProgress = Number(slider.value);
  commitMaxTime = timeScale.invert(commitProgress);
  document.querySelector('#commit-time').textContent =
    commitMaxTime.toLocaleString('en', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
  renderFiles(filteredCommits);
  renderCommitInfo(filteredCommits);
  updateScatterPlot(filteredCommits);
}

function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      // Each 'lines' array contains all lines modified in this commit
      // All lines in a commit have the same author, date, etc.
      // So we can get this information from the first line
      let first = lines[0];

      // We can use object destructuring to get these properties
      let { author, date, time, timezone, datetime } = first;

      let ret = {
        id: commit,
        url: 'https://github.com/e2pak/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };


      Object.defineProperty(ret, 'lines', {
        value: lines,
        enumerable: false,
        configurable: true,
        writable: true,
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}

function renderCommitInfo(commits) {
  const lines = commits.flatMap((commit) => commit.lines);
  const totalFiles = d3.rollup(lines, (v) => v.length, (d) => d.file).size;
  const fileLengths = d3.rollups(
    lines,
    (v) => d3.max(v, (line) => line.line),
    (line) => line.file,
  );
  const stats = [
    { label: 'Total <abbr title="Lines of code">LOC</abbr>', value: lines.length },
    { label: 'Total commits', value: commits.length },
    { label: 'Files', value: totalFiles },
    {
      label: 'Average file length',
      value: Math.round(d3.mean(fileLengths, (file) => file[1])),
    },
    { label: 'Longest file length', value: d3.max(fileLengths, (file) => file[1]) },
  ];

  const dl = d3
    .select('#stats')
    .selectAll('dl.stats')
    .data([null])
    .join('dl')
    .attr('class', 'stats');

  dl.selectAll('dt')
    .data(stats)
    .join('dt')
    .html((stat) => stat.label);
  dl.selectAll('dd')
    .data(stats)
    .join('dd')
    .text((stat) => stat.value);
}

function renderFiles(commits) {
  const lines = commits.flatMap((commit) => commit.lines);
  const files = d3
    .groups(lines, (line) => line.file)
    .map(([name, fileLines]) => ({
      name,
      lines: fileLines,
      type: fileLines[0].type,
    }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll(':scope > div.file')
    .data(files, (file) => file.name)
    .join((enter) =>
      enter.append('div').attr('class', 'file').call((div) => {
        div.append('dt').append('code');
        div.append('dd');
      }),
    )
    .attr('style', (file) => `--color: ${colors(file.type)}`);

  filesContainer.select('dt > code').text((file) => file.name);
  filesContainer
    .select('dt')
    .selectAll('small')
    .data((file) => [file])
    .join('small')
    .text((file) => `${file.lines.length} lines`);
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((file) => file.lines)
    .join('div')
    .attr('class', 'loc');
}

let xScale, yScale; // Declare scales in a broader scope

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;
  const svg = d3
  .select('#chart')
  .append('svg')
  .attr('viewBox', `0 0 ${width} ${height}`)
  .style('overflow', 'visible');
  xScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, width])
  .nice();
  yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);
  const timeColor = d3
    .scaleLinear()
    .domain([0, 12, 24])
    .range(['#2563eb', '#f59e0b', '#2563eb'])
    .interpolate(d3.interpolateHcl);
  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4,25]);
  const dots = svg.append('g').attr('class', 'dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines); // Sort commits by total lines in descending order
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => timeColor(d.hourFrac))
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
        d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
        renderTooltipContent(commit);
        updateTooltipVisibility(true);
        updateTooltipPosition(event);
    })
    .on('mouseleave', () => {
        d3.select(event.currentTarget).style('fill-opacity', 0.6);
        updateTooltipVisibility(false);
    });

  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
  top: margin.top,
  right: width - margin.right,
  bottom: height - margin.bottom,
  left: margin.left,
  width: width - margin.left - margin.right,
  height: height - margin.top - margin.bottom,
  };
  
  // Update scales with new ranges
  xScale.range([usableArea.left, usableArea.right]);
  yScale.range([usableArea.bottom, usableArea.top]);

  const gridlines = svg
  .append('g')
  .attr('class', 'gridlines')
  .attr('transform', `translate(${usableArea.left}, 0)`);
  gridlines
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width))
    .selectAll('line, path')
    .attr('stroke-opacity', 0.2);
  
  // Create the axes
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
  .axisLeft(yScale)
  .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis') // new line to mark the g tag
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis') // just for consistency
    .call(yAxis);
    
  createBrushSelector(svg);
}

function updateScatterPlot(commits) {
  const svg = d3.select('#chart').select('svg');
  xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([4, 25]);
  const timeColor = d3
    .scaleLinear()
    .domain([0, 12, 24])
    .range(['#2563eb', '#f59e0b', '#2563eb'])
    .interpolate(d3.interpolateHcl);

  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', (d) => timeColor(d.hourFrac))
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');


  if (Object.keys(commit).length === 0) return;


  link.href = commit.url;
  link.textContent = commit.id;
  date.textContent = commit.datetime?.toLocaleString('en', {
    dateStyle: 'full',
  });
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function createBrushSelector(svg) {
  // Update brush initialization to listen for events
  svg.call(d3.brush().on('start brush end', brushed));
  // Raise dots and everything after overlay
  svg.selectAll('.dots, .overlay ~ *').raise();

}

function brushed(event) {
  const selection = event.selection;
  d3.selectAll('circle').classed('selected', (d) =>
    isCommitSelected(selection, d),
  );
  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}


function isCommitSelected(selection, commit) {
  if (!selection) {
    return false;
  }
  const [x0, x1] = selection.map((d) => d[0]); 
  const [y0, y1] = selection.map((d) => d[1]); 
  const x = xScale(commit.datetime); 
  const y = yScale(commit.hourFrac); 
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];


  const countElement = document.querySelector('#selection-count');
  countElement.textContent = `${
    selectedCommits.length || 'No'
  } commits selected`;


  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? commits.filter((d) => isCommitSelected(selection, d))
    : [];
  const container = document.getElementById('language-breakdown');


  if (selectedCommits.length === 0) {
    container.innerHTML = '';
    return;
  }
  const requiredCommits = selectedCommits.length ? selectedCommits : commits;
  const lines = requiredCommits.flatMap((d) => d.lines);


  // Use d3.rollup to count lines per language
  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );


  // Update DOM with breakdown
  container.innerHTML = '';


  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);


    container.innerHTML += `
            <dt>${language}</dt>
            <dd>${count} lines (${formatted})</dd>
        `;
  }
}

let data = await loadData();
let commits = processCommits(data);

// Will get updated as user changes slider
let filteredCommits = commits;
let colors = d3
  .scaleOrdinal(d3.schemeTableau10)
  .domain(Array.from(new Set(data.map((line) => line.type))).sort());

timeScale = d3
  .scaleTime()
  .domain(d3.extent(commits, (d) => d.datetime))
  .range([0, 100]);
const commitProgressSlider = document.querySelector('#commit-progress');
renderScatterPlot(data, commits);
commitProgressSlider.addEventListener('input', onTimeSliderChange);
onTimeSliderChange();
console.log(commits);

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
		Then I looked over all I had made, and I saw that it was very good.
	`,
  );

function onStepEnter(response) {
  const enteredCommit = response.element.__data__;
  const commitsThroughStep = commits.filter(
    (commit) => commit.datetime <= enteredCommit.datetime,
  );
  updateScatterPlot(commitsThroughStep);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);
