using QueueCumber.Drivers;
using QueueCumber.Drivers.RabbitMQ;
using QueueCumber.Models.Entities;
using System.Linq.Expressions;

namespace QueueCumber.Core
{
    public class QueueCumberService:IQueueCumberService
    {
        private List<ConnectionIntance> ConnectionInstances { get; set; }

        

        public QueueCumberService() {

            ConnectionInstances = new List<ConnectionIntance>();

        }

        public void Connect(QueueCumberConnection connection)
        {
            var alreadyConnected = ConnectionInstances.Any(x => x.Connection.Id == connection.Id);

            if (alreadyConnected) {

                throw new Exception($"Already Connected to {connection.Name}({connection.Id})");

            }

            var newConn = new ConnectionIntance { Connection=connection };


            switch (newConn.Connection.Driver)
            {
                case Models.Enums.Drivers.RabbitMQ:
                    newConn.Driver = QueueCumberDriverRabbitMQ.Connect(connection);
                    break;
                case Models.Enums.Drivers.ApacheKafka:
                    // code block
                    break;
                default:
                    // code block
                    break;
            }

            ConnectionInstances.Add(newConn);

        }

        public ConnectionIntance? GetConnection(QueueCumberConnection connection) => GetConnection(connection.Id);

        public ConnectionIntance? GetConnection(int id)=> ConnectionInstances.FirstOrDefault(x => x.Connection.Id == id);

        public void Disconnect(QueueCumberConnection connection) => Disconnect(connection.Id);

        public void Disconnect(int id)
        {
            var toDisconnect = GetConnection(id);


            if (toDisconnect is null)
            {

                throw new Exception($"Not Connected to {toDisconnect.Connection.Name}({toDisconnect.Connection.Id})");

            }
            toDisconnect.Driver.Disconnect();

            ConnectionInstances = ConnectionInstances.Where(x=>x.Connection.Id!=toDisconnect.Connection.Id).ToList();

        }
    }



    public class ConnectionIntance { 
    
    public QueueCumberConnection Connection { get; set; }
    public IQueueCumberDriver Driver { get; set; }

    }
}
