# nearMe

#### Find out what's fun near me: [https://seventz.cc](https://seventz.cc)
A website integrated with events nearby with universal filters and interactive map views. 


## Key Features
- **Switch View Mode**: Map view and Event view  
    ![img](https://media.giphy.com/media/d88Z0WKCSh5R85zbC4/giphy.gif)
- **Filters** Choose by distance、type and location  
    ![img](https://media.giphy.com/media/L2es5kF45TsBRlZUuH/giphy.gif)
- **Search Function**: Support Keyword and real-time search  
    ![img](https://media.giphy.com/media/cJ4XtwbtLQAzwNaJbX/giphy.gif)

## Technical Skills:
- **Crawler Design**:
    - Scraped and integrated data from three sites: Meetup, Accupass and EventPal. 
    - Requested data from Meetup through OAuth2 based authentication.
    - Scheduled automatic data update via node-cron scheduler.
- **Search API**:
    - Provided keyword search and realtime search.
    - Integrated Redis cache as data and keyword caching solution for better search performance and precision.
- **Google Maps API**:
    - Embedded Google Maps for data visualization and interactive search for events.
- **Architecture**:
    - AWS EC2 for Node.js server
    - SSL credentials for HTTPs server.
    - MySQL database optimized with index and foreign keys
    - Jenkins for auto-deployment.
    - AWS S3 for image upload.
    - DAO design pattern implemented.
    - Database transaction for data consistency.




## Backend Architecture
![img](https://i.imgur.com/7b2D5c8.png)

## Database Schema
![img](https://i.imgur.com/ZYQIga1.png)



## Contact
**Chen Shih-Yuan (Mark)**
E-mail: zuhomak@hotmail.com
