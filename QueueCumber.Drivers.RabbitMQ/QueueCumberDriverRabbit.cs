using QueueCumber.Models;
using QueueCumber.Models.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Drivers.RabbitMQ
{
    public class QueueCumberDriverRabbitMQ : IQueueCumberDriver
    {

        private readonly QueueCumberConnection _connection;
        private readonly Guid SessionId;
        public QueueCumberDriverRabbitMQ(QueueCumberConnection connection)
        {
            this._connection = connection;

            SessionId= Guid.NewGuid();
        }

        public static IQueueCumberDriver Connect(QueueCumberConnection connection)
        {
            var ret = new QueueCumberDriverRabbitMQ(connection);



            return ret;
        }

        public void Disconnect()
        {
            throw new NotImplementedException();
        }

        public Enums.Drivers getDriver() => Enums.Drivers.RabbitMQ;

        public Guid getSessionId() => SessionId;

        public bool hasQueues() => true;

        public bool hasStreams() => true;

        public bool isConnected()=> throw new NotImplementedException();








    }
}
