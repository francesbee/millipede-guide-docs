# The Millipede Guide

![Test](https://github.com/millipede-guide/millipede-guide-docs/workflows/Test/badge.svg)

## Project Goals

- A guide to the natural wonders of the world
- Use of source control tools (Git) for a document-driven, open-source, collaborative guide "book"
- Extremely fast loading web pages to allow for slow wireless connections
- Minimalist document layout for maximum readability on small screens in harsh conditions
- Minimise UI animations (etc) to keep power use low and avoid draining battery
- Simple, timeless, fact-based data without prose, opinions, advice, descriptions or variables.
- Modern web browser user interface
- Continuous integration
- Serverless and downloadable for offline use

## Contribution Guidelines

- When you edit a document, please add your name to the end of the `copyright` list, separated by a comma.
- Documents must only relate to the natural world and natural wonders
- All documents must pass validation (tests) based on the predefined schema
- Fact-based data only
- Only submit information from first hand experience or primary sources (such as government agencies or parks services)
- Do not copy data or information from any commercial website, app or service
- Do not upload track files that have been provided by any other website, app or service
- Photos must be freely licensed or at least allow non-commercial use
- Ideally photos should represent an average experience in average conditions
- Photos should be selected to convey a cross-section of the overall experience
- Photos should contain as much information as possible so wide-angle and panoramic photos are preferable
- Photos should be avoided if they are primarily artistic, stylistically manipulated, selectively cropped or show rarely perfect conditions
- Where possible, photos should not include people or vehicles

## Running Validation Tests

### NodeJS

    npm install
    npm run test

### Docker Compose

    docker-compose up
